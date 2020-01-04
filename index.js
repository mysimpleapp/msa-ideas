const { join } = require('path')
const { IdeasDb, IdeaSetsDb } = require('./db')
const MsaSheet = Msa.require("sheet/module")
const { MsaVoteModule } = Msa.require("vote")
const userMdw = Msa.require("user/mdw")

const { IdeasPerm } = require("./perm")
const { globalParams, MsaParamsAdminModule } = Msa.require("params")
const { IdeasParamDict } = require("./params")

class MsaIdeasModule extends Msa.Module {

	constructor(dbId){
		super()
		this.dbId = dbId
		this.initDb()
		this.initApp()
		this.initSheet()
		this.initVote()
		this.initParams()
	}

	initDb(){
		this.db = IdeasDb
		this.setsDb = IdeaSetsDb
	}

	getDbId(id){
		return this.dbId + '-' + id
	}

	getUserId(req){
		const user = req.session ? req.session.user : null
		return user ? user.name : req.connection.remoteAddress
	}

	getPerm(permId, req, ideaSet){
		let param = deepGet(ideaSet, "params", permId)
		if(param === undefined) param = globalParams.ideas[permId]
		return param.get()
	}

	checkPerm(permId, req, ideaSet, expVal, prevVal){
		return this.getPerm(permId, req, ideaSet).check(req.session.user, expVal, prevVal)
	}

	canRead(req, ideaSet){
		return this.checkPerm("perm", req, ideaSet, IdeasPerm.READ)
	}

	canCreateIdea(req, ideaSet){
		return this.checkPerm("perm", req, ideaSet, IdeasPerm.PROPOSE)
	}

	canAdmin(req, ideaSet){
		return this.checkPerm("perm", req, ideaSet, IdeasPerm.ADMIN)
	}

	canReadIdea(req, ideaSet, idea){
		return this.checkPerm("perm", req, ideaSet, IdeasPerm.READ)
			|| (idea.createdBy == this.getUserId(req))
	}

	canWriteIdea(req, ideaSet, idea){
		return this.checkPerm("perm", req, ideaSet, IdeasPerm.ADMIN)
			|| (idea.createdBy == this.getUserId(req))
	}

	canRemoveIdea(req, ideaSet, idea){
		return this.checkPerm("perm", req, ideaSet, IdeasPerm.ADMIN)
			|| (idea.createdBy == this.getUserId(req))
	}

	formatIdea(req, ideaSet, dbIdea){
		const idea = dbIdea.dataValues
		idea.canRead = this.canReadIdea(req, ideaSet, idea)
		idea.canEdit = this.canWriteIdea(req, ideaSet, idea)
		idea.canRemove = this.canRemoveIdea(req, ideaSet, idea)
		return idea
	}

	initApp(){
		const app = this.app

		// get page
		app.get("/:id", (req, res, next) => {
			const id = req.params.id
			if(id.indexOf('-') >= 0 || id[0] === '_')
				return next()
			res.sendPage({
				wel:"/ideas/msa-ideas.js",
				attrs:{
					'base-url': req.baseUrl,
					'ideas-id': id
				}
			})
		})

		// list ideas
		app.get("/_list/:id", userMdw, async (req, res, next) => {
			try {
				const id = req.params.id,
					dbId = this.getDbId(req.params.id)
				// ideaSet
				const ideaSet = await this.setsDb.findOne({ where:{ id: dbId }})
				if(!this.canRead(req, ideaSet)) throw Msa.FORBIDDEN
				// ideas
				const ideas = (await this.db.findAll({ where:{ id: dbId }}))
					.map(idea => this.formatIdea(req, ideaSet, idea))
					.filter(idea => idea.canRead)
				// vote
				const ideasIds = ideas.map(idea => `${idea.id}-${idea.num}`)
				this.setReqVoteArgs(req, ideaSet)
				const votes = await this.vote.getVoteSets(req, ideasIds)
				// res
				res.json({
					ideas,
					votes,
					canAdmin: this.canAdmin(req, ideaSet),
					canCreateIdea: this.canCreateIdea(req, ideaSet)
				})
			} catch(err){ next(err) }
		})

		// post new idea
		app.post("/_idea/:id", userMdw, async (req, res, next) => {
			try {
				const dbId = this.getDbId(req.params.id),
					text = req.body.text,
					parent = req.body.parent
				const ideaSet = this.setsDb.findOne({ where:{ id: dbId }})
				if(!this.canCreateIdea(req, ideaSet)) throw Msa.FORBIDDEN
				const maxNum = await this.db.max('num', { where:{ id: dbId }})
				const num = Number.isNaN(maxNum) ? 0 : (maxNum+1)
				const createdBy = this.getUserId(req)
				await this.db.create({ id: dbId,  num, text, parent, createdBy })
				res.sendStatus(200)
			} catch(err) { next(err) }
		})

		// delete idea
		app.delete("/_idea/:id/:num", userMdw, async (req, res, next) => {
			try {
				const id = this.getDbId(req.params.id),
					num = req.params.num
				const userId = this.getUserId(req)
				const idea = await this.db.find({ where:{ id, num }})
				if(!this.canRemoveIdea(req, null, idea)) // TODO fetch ideaSet
					return next(Msa.FORBIDDEN)
				await this.db.destroy({ where:{ id, num } })
				// TODO rm votes
				res.sendStatus(200)
			} catch(err) { next(err) }
		})
	}

	useWithIdea(route, subApp, callback){
		this.app.use(route,
			userMdw,
			async (req, res, next) => {
				try {
					const dbId = this.getDbId(req.params.id)
					const ideaSet = await this.setsDb.findOne({ where:{ id: dbId }})
					callback(req, ideaSet)
					next()
				} catch(err){ next(err) }
			},
			subApp)
	}


	// sheet

	initSheet(){
		this.sheet = new class extends MsaSheet {
			getDbIdPrefix(req){
				return req.ideasSheetArgs.dbIdPrefix
			}
			checkPerm(req, voteSet, expVal) {
				let prevVal
				const perm = req.ideasSheetArgs.perm
				if(perm) prevVal = toSheetPermVal(perm.solve(req.session.user))
				return super.checkPerm(req, voteSet, expVal, prevVal)
			}
		}

		this.useWithIdea("/_sheet/:id", this.sheet.app,
			(req, ideaSet) => this.setReqSheetArgs(req, ideaSet))
	}

	setReqSheetArgs(req, ideaSet){
		req.ideasSheetArgs = {
			dbIdPrefix: this.getDbId(req.params.id),
			perm: this.getPerm("perm", req, ideaSet)
		}
	}


	// vote

	initVote(){
		this.vote = new class extends MsaVoteModule {
			getDbIdPrefix(req){
				return req.ideasVotesArgs.dbIdPrefix
			}
			checkPerm(req, voteSet, expVal, prevVal) {
				const perm = req.ideasVotesArgs.perm
				if(perm) prevVal = perm.solve(req.session.user, prevVal)
				return super.checkPerm(req, voteSet, expVal, prevVal)
			}
		}

		this.useWithIdea("/_vote/:id", this.vote.app,
			(req, ideaSet) => this.setReqVoteArgs(req, ideaSet))
	}

	setReqVoteArgs(req, ideaSet){
		req.ideasVotesArgs = {
			dbIdPrefix: this.getDbId(req.params.id),
			perm: this.getPerm("votesPerm", req, ideaSet)
		}
	}


	// params

	initParams(){

		this.params = new class extends MsaParamsAdminModule {

			async getRootParam(req){
				const row = (await IdeaSetsDb.findOne({
					attributes: [ "params" ],
					where: { "id": req.ideasParamsArgs.id }}))
				const param = row ? row["params"] : (new IdeasParamDict())
				return param
			}
		
			async updateParamInDb(req, id, rootParam, param){
				await IdeaSetsDb.update(
					{ params: rootParam },
					{ where: { "id": req.ideasParamsArgs.id }})
			}
		}

		this.useWithIdea("/_params/:id", this.params.app,
			(req, ideaSet) => {
				req.ideasParamsArgs = {
					id: this.getDbId(req.params.id)
				}})
	}
}


// perm

function toSheetPermVal(permVal){
	switch(permVal){
		case 3: return 2;
		case 2: return 1;
		default: return permVal;
	}
}

// utils

function deepGet(obj, key, ...args){
	if(obj === null) return undefined
	const obj2 = obj[key]
	if(obj2 === undefined) return
	if(args.length === 0) return obj2
	return deepGet(obj2, ...args)
}

// export
const exp = module.exports = new MsaIdeasModule("ideas")
exp.MsaIdeasModule = MsaIdeasModule

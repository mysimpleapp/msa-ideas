const { join } = require('path')
const { IdeasDb, IdeaSetsDb } = require('./db')
const MsaSheet = Msa.require("sheet/module")
const { MsaVoteModule } = Msa.require("vote")
const userMdw = Msa.require("user/mdw")

const { globalParams, MsaParamsAdminLocalModule } = Msa.require("params")
const { ideasParamsDef } = require("./params")

class MsaIdeasModule extends Msa.Module {

	constructor(dbKey){
		super()
		this.dbKey = dbKey
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

	getDbKey(key){
		return this.dbKey + '-' + key
	}

	getUserKey(req){
		const user = req.session ? req.session.user : null
		return user ? user.name : req.connection.remoteAddress
	}

	getPerm(paramKey, req, ideaSet){
		let param = deepGet(ideaSet, "params", paramKey)
		if(param === undefined) param = globalParams.ideas[paramKey]
		return param
	}

	canRead(req, ideaSet){
		return this.getPerm("readPerm", req, ideaSet).check(req.session.user)
	}

	canCreateIdea(req, ideaSet){
		return this.getPerm("createIdeaPerm", req, ideaSet).check(req.session.user)
	}

	canAdmin(req, ideaSet){
		return this.getPerm("adminPerm", req, ideaSet).check(req.session.user)
	}

	canReadIdea(req, ideaSet, idea){
		return this.getPerm("readIdeaPerm", req, ideaSet).check(req.session.user)
			|| (idea.createdBy == this.getUserKey(req))
	}

	canWriteIdea(req, ideaSet, idea){
		return this.getPerm("adminPerm", req, ideaSet).check(req.session.user)
			|| (idea.createdBy == this.getUserKey(req))
	}

	canRemoveIdea(req, ideaSet, idea){
		return this.getPerm("adminPerm", req, ideaSet).check(req.session.user)
			|| (idea.createdBy == this.getUserKey(req))
	}

	canReadVoteOnIdea(req, ideaSet, idea){
		return this.getPerm("readVotePerm", req, ideaSet).check(req.session.user)
	}

	canVoteOnIdea(req, ideaSet, idea){
		return this.getPerm("votePerm", req, ideaSet).check(req.session.user)
	}

	formatIdea(req, ideaSet, dbIdea){
		const idea = dbIdea.dataValues
		idea.canRead = this.canReadIdea(req, ideaSet, idea)
		idea.canEdit = this.canWriteIdea(req, ideaSet, idea)
		idea.canRemove = this.canRemoveIdea(req, ideaSet, idea)
		idea.canReadVote = this.canReadVoteOnIdea(req, ideaSet, idea)
		idea.canVote = this.canVoteOnIdea(req, ideaSet, idea)
		return idea
	}

	initApp(){
		const app = this.app

		// get page
		app.get("/:key", (req, res, next) => {
			const key = req.params.key
			if(key.indexOf('-') >= 0 || key[0] === '_')
				return next()
			res.sendPage({
				wel:"/ideas/msa-ideas.js",
				attrs:{
					'base-url': req.baseUrl,
					key
				}
			})
		})

		// list ideas
		app.get("/_list/:key", userMdw, async (req, res, next) => {
			try {
				const key = req.params.key,
					dbKey = this.getDbKey(req.params.key)
				// ideaSet
				const ideaSet = await this.setsDb.findOne({ where:{ key: dbKey }})
				if(!this.canRead(req, ideaSet)) throw Msa.FORBIDDEN
				// ideas
				const ideas = (await this.db.findAll({ where:{ key: dbKey }}))
					.map(idea => this.formatIdea(req, ideaSet, idea))
					.filter(idea => idea.canRead)
				// vote
				this.setReqVoteArgs(req, ideaSet)
				const votes = await this.vote.getVoteSets(req, dbKey)
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
		app.post("/_idea/:key", userMdw, async (req, res, next) => {
			try {
				const dbKey = this.getDbKey(req.params.key),
					text = req.body.text,
					parent = req.body.parent
				const ideaSet = this.setsDb.findOne({ where:{ key: dbKey }})
				if(!this.canCreateIdea(req, ideaSet)) throw Msa.FORBIDDEN
				const maxNum = await this.db.max('num', { where:{ key: dbKey }})
				const num = Number.isNaN(maxNum) ? 0 : (maxNum+1)
				const createdBy = this.getUserKey(req)
				await this.db.create({ key: dbKey,  num, text, parent, createdBy })
				res.sendStatus(200)
			} catch(err) { next(err) }
		})

		// delete idea
		app.delete("/_idea/:key/:num", userMdw, async (req, res, next) => {
			try {
				const key = this.getDbKey(req.params.key),
					num = req.params.num
				const userKey = this.getUserKey(req)
				const idea = await this.db.find({ where:{ key, num }})
				if(!this.canRemoveIdea(req, null, idea)) // TODO fetch ideaSet
					return next(Msa.FORBIDDEN)
				await this.db.destroy({ where:{ key, num } })
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
					const dbKey = this.getDbKey(req.params.key)
					const ideaSet = await this.setsDb.findOne({ where:{ key: dbKey }})
					callback(req, ideaSet)
					next()
				} catch(err){ next(err) }
			},
			subApp)
	}


	// sheet

	initSheet(){
		this.sheet = new MsaSheet()
		this.useWithIdea("/_sheet/:key", this.sheet.app,
			(req, ideaSet) => this.setReqSheetArgs(req, ideaSet))
	}

	setReqSheetArgs(req, ideaSet){
		req.sheetArgs = {
			dbKeyPrefix: this.getDbKey(req.params.key),
			params: {
				readPerm: this.getPerm("readPerm", req, ideaSet),
				writePerm: this.getPerm("adminPerm", req, ideaSet)
			}
		}
	}


	// vote

	initVote(){
		this.vote = new MsaVoteModule(this.dbKey)
		this.useWithIdea("/_vote/:key", this.vote.app,
			(req, ideaSet) => this.setReqVoteArgs(req, ideaSet))
	}

	setReqVoteArgs(req, ideaSet){
		req.voteArgs = {
			dbKeyPrefix: this.getDbKey(req.params.key),
			params: {
				readPerm: this.getPerm("readPerm", req, ideaSet),
				votePerm: this.getPerm("votePerm", req, ideaSet)
			}
		}
	}


	// params

	initParams(){
		this.params = new MsaParamsAdminLocalModule({
			paramDef: ideasParamsDef,
			db: IdeaSetsDb,
			dbPkCols: ["key"]
		})

		this.useWithIdea("/_params/:key", this.params.app,
			(req, ideaSet) => this.setReqParamsArgs(req, ideaSet))
	}

	setReqParamsArgs(req, ideaSet){
		req.msaParamsArgs = {
			dbPkVals: [ this.getDbKey(req.params.key) ]
		}
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

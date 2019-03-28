const { join } = require('path')
const { IdeasDb } = require('./db')
const MsaSheet = Msa.require("sheet/module")
const { MsaVoteModule } = Msa.require("vote")
const { permPublic } = Msa.require("user/perm")

class MsaIdeasModule extends Msa.Module {

	constructor(dbKey){
		super()
		this.dbKey = dbKey
		this.initDb()
		this.initSheet()
		this.initVote()
		this.initApp()
	}

	initDb(){
		this.db = IdeasDb
	}

	initSheet(){
		this.sheet = new MsaSheet(this.dbKey)
		this.sheet.getCreatePerm = () => permPublic
	}

	initVote(){
		this.vote = new MsaVoteModule(this.dbKey)
	}

	getDbKey(key){
		return this.dbKey + '-' + key
	}

	getUserKey(req){
		const user = req.session ? req.session.user : null
		return user ? user.name : req.connection.remoteAddress
	}

	canUserEditIdea(idea, userKey){
		return (idea.createdBy == userKey)
	}

	canUserRemoveIdea(idea, userKey){
		return (idea.createdBy == userKey)
	}

	completeIdea(idea, req){
		idea.canEdit = this.canUserEditIdea(idea, this.getUserKey(req))
		idea.canRemove = this.canUserRemoveIdea(idea, this.getUserKey(req))
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
		app.get("/_list/:key", async (req, res, next) => {
			const key = this.getDbKey(req.params.key)
			const ideas = (await this.db.findAll({ where:{ key }}))
				.map(idea => idea.dataValues)
			ideas.forEach(idea => this.completeIdea(idea, req))
			const votes = await this.vote.getVoteCounts(key)
			res.json({ ideas, votes })
		})

		// post new idea
		app.post("/_idea/:key", async (req, res, next) => {
			try {
				const key = this.getDbKey(req.params.key),
					text = req.body.text,
					parent = req.body.parent
				const maxNum = await this.db.max('num', { where:{ key }})
				const num = Number.isNaN(maxNum) ? 0 : (maxNum+1)
				const createdBy = this.getUserKey(req)
				await this.db.create({ key, num, text, parent, createdBy })
				res.sendStatus(200)
			} catch(err) { next(err) }
		})

		// delete idea
		app.delete("/_idea/:key/:num", async (req, res, next) => {
			try {
				const key = this.getDbKey(req.params.key),
					num = req.params.num
				const userKey = this.getUserKey(req)
				const idea = await this.db.find({ where:{ key, num }})
				if(!this.canUserRemoveIdea(idea, userKey))
					return next(Msa.FORBIDDEN)
				await this.db.destroy({ where:{ key, num } })
				// TODO rm votes
				res.sendStatus(200)
			} catch(err) { next(err) }
		})

		// deps
		app.use("/_sheet", this.sheet.app)
		app.use("/_vote", this.vote.app)
	}
}

// export
const exp = module.exports = new MsaIdeasModule("ideas")
exp.MsaIdeasModule = MsaIdeasModule

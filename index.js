const { join } = require('path')
const { IdeasDb } = require('./db')
const { MsaVoteModule } = Msa.require("vote")

class MsaIdeasModule extends Msa.Module {

	constructor(dbKey){
		super("ideas")
		this.dbKey = dbKey
		this.initDb()
		this.initVote()
		this.initApp()
	}

	initDb(){
		this.db = IdeasDb
	}

	initVote(){
		this.vote = new MsaVoteModule(this.dbKey)
	}

	getFullDbKey(key){
		return this.dbKey + '-' + key
	}

	initApp(){
		const app = this.app

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
		app.get("/_list/:key", (req, res, next) => {
			const key = this.getFullDbKey(req.params.key)
			this.db.findAll({ where:{ key }}).then(
				ideas => res.json(ideas),
				err => next(err))
		})

		// post new idea
		app.post("/_idea/:key", async (req, res, next) => {
			try {
				const key = this.getFullDbKey(req.params.key),
					text = req.body.text
				const maxNum = await this.db.max('num', { where:{ key }})
				const num = Number.isNaN(maxNum) ? 0 : (maxNum+1)
				await this.db.create({ key, num, text })
				res.sendStatus(200)
			} catch(err) {
				next(err)
			}
		})

		// vote
		app.use("/_vote", this.vote.app)
	}
}

// export
const exp = module.exports = new MsaIdeasModule("ideas")
exp.MsaIdeasModule = MsaIdeasModule

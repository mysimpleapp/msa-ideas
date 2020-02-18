const { withDb } = Msa.require('db')
const { Idea, IdeaSet } = require('./model')
const MsaSheet = Msa.require("sheet/module")
const { MsaVoteModule } = Msa.require("vote")
const userMdw = Msa.require("user/mdw")

const { IdeasPerm } = require("./perm")
const { MsaParamsLocalAdminModule } = Msa.require("params")

class MsaIdeasModule extends Msa.Module {

	constructor() {
		super()
		this.initDeps()
		this.initApp()
		this.initSheet()
		this.initVote()
		this.initParams()
	}

	initDeps() {
		this.Idea = Idea
		this.IdeaSet = IdeaSet
	}

	getId(ctx, reqId) {
		return `ideas-${reqId}`
	}

	getUserId(ctx) {
		const user = ctx.user
		return user ? user.id : ctx.connection.remoteAddress
	}

	getUserName(ctx, reqUserName) {
		const user = ctx.user
		return user ? user.name : reqUserName
	}

	checkPerm(ctx, ideaSet, permId, expVal, prevVal) {
		const perm = ideaSet.params[permId].get()
		return perm.check(ctx.user, expVal, prevVal)
	}

	canRead(ctx, ideaSet) {
		return this.checkPerm(ctx, ideaSet, "perm", IdeasPerm.READ)
	}

	canCreateIdea(ctx, ideaSet) {
		return this.checkPerm(ctx, ideaSet, "perm", IdeasPerm.PROPOSE)
	}

	canAdmin(ctx, ideaSet) {
		return this.checkPerm(ctx, ideaSet, "perm", IdeasPerm.ADMIN)
	}

	canReadIdea(ctx, ideaSet, idea) {
		return this.checkPerm(ctx, ideaSet, "perm", IdeasPerm.READ)
			|| (idea.createdById == this.getUserId(ctx))
	}

	canWriteIdea(ctx, ideaSet, idea) {
		return this.checkPerm(ctx, ideaSet, "perm", IdeasPerm.ADMIN)
			|| (idea.createdById == this.getUserId(ctx))
	}

	canRemoveIdea(ctx, ideaSet, idea) {
		return this.checkPerm(ctx, ideaSet, "perm", IdeasPerm.ADMIN)
			|| (idea.createdById == this.getUserId(ctx))
	}

	initApp() {
		const app = this.app

		// get page
		app.get("/:id", (req, res, next) => {
			const id = req.params.id
			if (id.indexOf('-') >= 0 || id[0] === '_')
				return next()
			res.sendPage({
				wel: "/ideas/msa-ideas.js",
				attrs: {
					'base-url': req.baseUrl,
					'ideas-id': id
				}
			})
		})

		// list ideas
		app.get("/_list/:id", userMdw, (req, res, next) => {
			withDb(async db => {
				const ctx = newCtx(req, { db })
				const id = this.getId(ctx, req.params.id)
				const ideaSet = await this.getIdeaSet(ctx, id)
				const ideas = await this.getIdeas(ctx, ideaSet)
				// vote
				const ideasIds = ideas.map(idea => `${idea.id}-${idea.num}`)
				this.setReqVoteArgs(req, ideaSet)
				const votes = await this.vote.getVoteSets(ctx, ideasIds)
				// res
				res.json({
					ideas: ideas.map(i => this.exportIdea(ctx, ideaSet, i)),
					votes,
					canAdmin: this.canAdmin(ctx, ideaSet),
					canCreateIdea: this.canCreateIdea(ctx, ideaSet)
				})
			}).catch(next)
		})

		// post new idea
		app.post("/_idea/:id", userMdw, async (req, res, next) => {
			withDb(async db => {
				const ctx = newCtx(req, { db })
				const id = this.getId(ctx, req.params.id)
				const { content, parent, by } = req.body
				const ideaSet = await this.getIdeaSet(ctx, id)
				await this.createIdea(ctx, ideaSet, content, { parent, by })
				res.sendStatus(Msa.OK)
			}).catch(next)
		})

		// post existing idea
		app.post("/_idea/:id/:num", userMdw, async (req, res, next) => {
			withDb(async db => {
				const ctx = newCtx(req, { db })
				const id = this.getId(ctx, req.params.id),
					num = req.params.num
				const { content, by } = req.body
				const ideaSet = await this.getIdeaSet(ctx, id)
				await this.updateIdea(ctx, ideaSet, num, content, { by })
				res.sendStatus(Msa.OK)
			}).catch(next)
		})

		// delete idea
		app.delete("/_idea/:id/:num", userMdw, async (req, res, next) => {
			withDb(async db => {
				const ctx = newCtx(req, { db })
				const id = this.getId(ctx, req.params.id),
					num = req.params.num
				const ideaSet = await this.getIdeaSet(ctx, id)
				const idea = await this.getIdea(ctx, ideaSet, num)
				if (!this.canRemoveIdea(ctx, ideaSet, idea))
					return next(Msa.FORBIDDEN)
				await this.removeIdea(ctx, ideaSet, num)
				// TODO rm votes
				res.sendStatus(Msa.OK)
			}).catch(next)
		})
	}

	async getIdeaSet(ctx, id) {
		const dbIdeaSet = await ctx.db.getOne("SELECT id, params FROM msa_idea_sets WHERE id=:id", { id })
		const ideaSet = this.IdeaSet.newFromDb(id, dbIdeaSet)
		if (!this.canRead(ctx, ideaSet)) throw Msa.FORBIDDEN
		return ideaSet
	}

	async getIdeas(ctx, ideaSet) {
		const dbIdeas = await ctx.db.get("SELECT id, num, parent, content, createdById, createdBy, updatedBy, createdAt, updatedAt FROM msa_ideas WHERE id=:id",
			{ id: ideaSet.id })
		const ideas = dbIdeas
			.map(dbIdea => this.Idea.newFromDb(dbIdea.id, dbIdea.num, dbIdea))
			.filter(idea => this.canReadIdea(ctx, ideaSet, idea))
		return ideas
	}

	async getIdea(ctx, ideaSet, num) {
		const dbIdea = await ctx.db.getOne("SELECT id, num, parent, content, createdById, createdBy, updatedBy, createdAt, updatedAt FROM msa_ideas WHERE id=:id AND num=:num",
			{ id: ideaSet.id, num })
		const idea = this.Idea.newFromDb(ideaSet.id, num, dbIdea)
		if (!this.canRead(ctx, ideaSet, idea)) throw Msa.FORBIDDEN
		return idea
	}

	async createIdea(ctx, ideaSet, content, kwargs) {
		if (!this.canCreateIdea(ctx, ideaSet)) throw Msa.FORBIDDEN
		const id = ideaSet.id
		const res = await ctx.db.getOne("SELECT MAX(num) AS max_num FROM msa_ideas WHERE id=:id", { id })
		const num = (res && typeof res.max_num === "number") ? (res.max_num + 1) : 0
		const idea = new this.Idea(id, num)
		idea.content = content
		idea.parent = kwargs && kwargs.parent
		idea.createdById = this.getUserId(ctx)
		idea.createdBy = idea.updatedBy = this.getUserName(ctx, kwargs && kwargs.by)
		idea.createdAt = idea.updatedAt = new Date(Date.now())
		await ctx.db.run("INSERT INTO msa_ideas (id, num, content, parent, createdById, createdBy, updatedBy, createdAt, updatedAt) VALUES (:id, :num, :content, :parent, :createdById, :createdBy, :updatedBy, :createdAt, :updatedAt)",
			idea.formatForDb())
		return idea
	}

	async updateIdea(ctx, ideaSet, num, content, kwargs) {
		const idea = await this.getIdea(ctx, ideaSet, num)
		if (!this.canWriteIdea(ctx, ideaSet, idea)) throw Msa.FORBIDDEN
		idea.content = content
		idea.updatedBy = this.getUserName(ctx, kwargs && kwargs.by)
		idea.updatedAt = new Date(Date.now())
		await ctx.db.run("UPDATE msa_ideas SET content=:content, updatedBy=:updatedBy, updatedAt=:updatedAt WHERE id=:id AND num=:num",
			idea.formatForDb(["id", "num", "content", "updatedBy", "updatedAt"]))
	}

	async removeIdea(ctx, ideaSet, num) {
		if (!this.canRemoveIdea(ctx, ideaSet)) throw Msa.FORBIDDEN
		await ctx.db.run("DELETE FROM msa_ideas WHERE id=:id AND num=:num",
			{ id: ideaSet.id, num })
	}

	exportIdea(ctx, ideaSet, idea) {
		return {
			id: idea.id,
			num: idea.num,
			content: idea.content,
			parent: idea.parent,
			createdBy: idea.createdBy,
			updatedBy: idea.updatedBy,
			createdAt: idea.createdAt ? idea.createdAt.toISOString() : null,
			updatedAt: idea.updatedAt ? idea.updatedAt.toISOString() : null,
			canEdit: this.canWriteIdea(ctx, ideaSet, idea),
			canRemove: this.canRemoveIdea(ctx, ideaSet, idea)
		}
	}


	// sheet

	initSheet() {

		this.sheet = new class extends MsaSheet {
			getId(ctx, reqId) {
				return `${ctx.ideasSheetArgs.dbIdPrefix}-${reqId}`
			}
			checkPerm(req, voteSet, expVal) {
				let prevVal
				const perm = req.ideasSheetArgs.perm
				if (perm) prevVal = toSheetPermVal(perm.solve(req.session.user))
				return super.checkPerm(req, voteSet, expVal, prevVal)
			}
		}

		this.app.use("/_sheet/:id", (req, res, next) => {
			withDb(async db => {
				const ctx = newCtx(req, { db })
				const id = this.getId(ctx, req.params.id)
				const ideaSet = await this.getIdeaSet(ctx, id)
				req.ideasSheetArgs = {
					dbIdPrefix: id,
					perm: ideaSet.params.perm.get()
				}
				next()
			}).catch(next)
		}, this.sheet.app)
	}


	// vote

	initVote() {
		this.vote = new class extends MsaVoteModule {
			getId(ctx, reqId) {
				return `${ctx.ideasVotesArgs.dbIdPrefix}-${reqId}`
			}
			checkPerm(req, voteSet, expVal, prevVal) {
				const perm = req.ideasVotesArgs.perm
				if (perm) prevVal = perm.solve(req.session.user, prevVal)
				return super.checkPerm(req, voteSet, expVal, prevVal)
			}
		}

		this.app.use("/_vote/:id", (req, res, next) => {
			withDb(async db => {
				const ctx = newCtx(req, { db })
				const id = this.getId(ctx, req.params.id)
				const ideaSet = await this.getIdeaSet(ctx, id)
				this.setReqVoteArgs(req, ideaSet)
				next()
			}).catch(next)
		}, this.vote.app)
	}

	setReqVoteArgs(req, ideaSet) {
		req.ideasVotesArgs = {
			dbIdPrefix: ideaSet.id,
			perm: ideaSet.params.votesPerm.get()
		}
	}


	// params

	initParams() {

		const IdeaSet = this.IdeaSet

		this.params = new class extends MsaParamsLocalAdminModule {

			async getRootParam(ctx) {
				const id = ctx.ideasParamsArgs.id
				const dbRow = await ctx.db.getOne("SELECT params FROM msa_idea_sets WHERE id=:id",
					{ id })
				return IdeaSet.newFromDb(id, dbRow).params
			}

			async updateRootParam(ctx, rootParam) {
				const vals = {
					id: ctx.ideasParamsArgs.id,
					params: rootParam.getAsDbStr()
				}
				const res = await ctx.db.run("UPDATE msa_idea_sets SET params=:params WHERE id=:id", vals)
				if (res.nbChanges === 0)
					await ctx.db.run("INSERT INTO msa_idea_sets (id, params) VALUES (:id, :params)", vals)
			}
		}

		this.app.use("/_params/:id", (req, res, next) => {
			try {
				const id = this.getId(req, req.params.id)
				req.ideasParamsArgs = { id }
				next()
			} catch (err) { next(err) }
		}, this.params.app)
	}
}


// perm

function toSheetPermVal(permVal) {
	switch (permVal) {
		case 3: return 2;
		case 2: return 1;
		default: return permVal;
	}
}

// utils

function newCtx(req, kwargs) {
	const ctx = Object.create(req)
	Object.assign(ctx, kwargs)
	return ctx
}

// export
const exp = module.exports = new MsaIdeasModule()
exp.MsaIdeasModule = MsaIdeasModule

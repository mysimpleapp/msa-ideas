const { IdeasParamDict } = require("./params")

const exp = module.exports = {}


exp.IdeaSet = class {

    constructor(id) {
        this.id = id
        this.params = new IdeasParamDict()
    }

    formatForDb() {
        return {
            id: this.id,
            params: this.params.getAsDbStr()
        }
    }

    parseFromDb(dbIdeaSet) {
        this.params = IdeasParamDict.newFromDbStr(dbIdeaSet.params)
    }

    static newFromDb(id, dbIdeaSet) {
        const ideaSet = new this(id)
        if (dbIdeaSet) ideaSet.parseFromDb(dbIdeaSet)
        return ideaSet
    }
}


exp.Idea = class {

    constructor(id, num) {
        this.id = id
        this.num = num
    }

    formatForDb(keys) {
        const res = {}
        if (!keys || keys.indexOf("id") >= 0)
            res.id = this.id
        if (!keys || keys.indexOf("num") >= 0)
            res.num = this.num
        if (!keys || keys.indexOf("parent") >= 0)
            res.parent = this.parent
        if (!keys || keys.indexOf("content") >= 0)
            res.content = this.content
        if (!keys || keys.indexOf("createdById") >= 0)
            res.createdById = this.createdById
        if (!keys || keys.indexOf("createdBy") >= 0)
            res.createdBy = this.createdBy
        if (!keys || keys.indexOf("updatedBy") >= 0)
            res.updatedBy = this.updatedBy
        return res
    }

    parseFromDb(dbIdea) {
        this.parent = dbIdea.parent
        this.content = dbIdea.content
        this.createdById = dbIdea.createdById
        this.createdBy = dbIdea.createdBy
        this.updatedBy = dbIdea.updatedBy
    }

    static newFromDb(id, num, dbIdea) {
        const idea = new this(id, num)
        if (dbIdea) idea.parseFromDb(dbIdea)
        return idea
    }
}
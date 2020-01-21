const { IdeasParamDict } = require("./params")

const exp = module.exports = {}


exp.IdeaSet = class {

    constructor(id){
        this.id = id
        this.params = new IdeasParamDict()
    }

    formatForDb(){
        return {
            id: this.id,
            params: this.params.getAsDbVal()
        }
    }
    
    parseFromDb(dbIdeaSet){
        this.params = IdeasParamDict.newFromDbVal(dbIdeaSet.params)
    }

    static newFromDb(id, dbIdeaSet){
        const ideaSet = new this(id)
        if(dbIdeaSet) ideaSet.parseFromDb(dbIdeaSet)
        return ideaSet
    }
}


exp.Idea = class {

    constructor(id, num){
        this.id = id
        this.num = num
    }

    formatForDb(){
        return {
            id: this.id,
            num: this.num,
            parent: this.parent,
            text: this.text,
            createdBy: this.createdBy,
            updatedBy: this.updatedBy
        }
    }
    
    parseFromDb(dbIdea){
        this.parent = dbIdea.parent
        this.text = dbIdea.text
        this.createdBy = dbIdea.createdBy
        this.updatedBy = dbIdea.updatedBy
    }

    static newFromDb(id, num, dbIdea){
        const idea = new this(id, num)
        if(dbIdea) idea.parseFromDb(dbIdea)
        return idea
    }
}
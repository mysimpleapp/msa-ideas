const { ParamDict, addGlobalParam, ParamBool } = Msa.require("params")
const { IdeasPerm } = require("./perm")
const { VotePerm } = Msa.require("vote/perm")

class IdeasParamDict extends ParamDict {
    constructor() {
        super()
        this.perm = IdeasPerm.newParam()
        this.canVote = new ParamBool(true)
        this.votesPerm = VotePerm.newParam()
    }
}

addGlobalParam("ideas", IdeasParamDict)

module.exports = { IdeasParamDict }

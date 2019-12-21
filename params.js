const { ParamsDef, addGlobalParam } = Msa.require("params")
const { IdeasPerm } = require("./perm")
const { VotePerm } = Msa.require("vote/perm")

const ideasParamsDef = new ParamsDef()
ideasParamsDef.add("perm", IdeasPerm.newPermParamDef({ group:"all", value:IdeasPerm.PROPOSE }))
ideasParamsDef.add("votesPerm", VotePerm.newPermParamDef({ group:"all", value:VotePerm.VOTE }))

addGlobalParam("ideas", ideasParamsDef)

module.exports = { ideasParamsDef }

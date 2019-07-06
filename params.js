const { ParamsDef, addGlobalParam } = Msa.require("params")
const { permPublic, permNumPublic, permAdmin, PermParamDef, PermNumParamDef, PermNum, newPermParamDef } = Msa.require("user")
const { IdeasPerm } = require("./perm")
const { VotePerm } = Msa.require("vote/perm")

const ideasParamsDef = new ParamsDef()
ideasParamsDef.add("perm", newPermParamDef(IdeasPerm, IdeasPerm.PROPOSE))
ideasParamsDef.add("votesPerm", newPermParamDef(VotePerm, VotePerm.VOTE))

addGlobalParam("ideas", ideasParamsDef)

module.exports = { ideasParamsDef }

const { ParamsDef, addGlobalParam } = Msa.require("params")
const { permPublic, permAdmin, PermParamDef } = Msa.require("user")

const ideasParamsDef = new ParamsDef()
ideasParamsDef.add("readPerm", new PermParamDef({
	defVal: permPublic
}))
ideasParamsDef.add("readIdeaPerm", new PermParamDef({
	defVal: permPublic
}))
ideasParamsDef.add("readVotePerm", new PermParamDef({
	defVal: permPublic
}))
ideasParamsDef.add("createIdeaPerm", new PermParamDef({
	defVal: permPublic
}))
ideasParamsDef.add("votePerm", new PermParamDef({
	defVal: permPublic
}))
ideasParamsDef.add("adminPerm", new PermParamDef({
	defVal: permAdmin
}))

addGlobalParam("ideas", ideasParamsDef)

module.exports = { ideasParamsDef }

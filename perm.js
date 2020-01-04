const { PermNum } = Msa.require("user/perm")

const labels = [
	{ name: "None" },
	{ name: "Read" },
	{ name: "Propose" },
	{ name: "Admin" }]

const defExpr = { group:"all", value:2 }

class IdeasPerm extends PermNum {
	getMaxVal(){ return 3 }
	getLabels(){ return labels }
	getDefaultExpr(){ return defExpr }
}
IdeasPerm.NONE = 0
IdeasPerm.READ = 1
IdeasPerm.PROPOSE = 2
IdeasPerm.ADMIN = 3

module.exports = { IdeasPerm }

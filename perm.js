const { PermNum } = Msa.require("user/perm")

class IdeasPerm extends PermNum {
	getMaxVal(){ return 3 }
}
IdeasPerm.NONE = 0
IdeasPerm.READ = 1
IdeasPerm.PROPOSE = 2
IdeasPerm.ADMIN = 3

module.exports = { IdeasPerm }

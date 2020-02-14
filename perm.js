const { PermNum } = Msa.require("user/perm")
const { isAdmin } = Msa.require("user/utils")

const labels = [
	{ name: "None" },
	{ name: "Read" },
	{ name: "Propose" },
	{ name: "Admin" }]

class IdeasPerm extends PermNum {
	getMaxVal() { return 3 }
	getLabels() { return labels }
	getDefaultValue() { return 2 }
	overwriteSolve(user) {
		if (isAdmin(user)) return 3
	}
}
IdeasPerm.NONE = 0
IdeasPerm.READ = 1
IdeasPerm.PROPOSE = 2
IdeasPerm.ADMIN = 3

module.exports = { IdeasPerm }
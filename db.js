// DB model
const { orm, Orm } = Msa.require("db")
const { IdeasParamDict } = require("./params")

const IdeasDb = orm.define('msa_ideas', {
	id: { type: Orm.STRING, primaryKey: true },
	num: { type: Orm.INTEGER, primaryKey: true },
	parent: Orm.INTEGER,
	text: Orm.TEXT,
	createdBy: Orm.STRING,
	updatedBy: Orm.STRING
})

const IdeaSetsDb = orm.define('msa_idea_sets', {
	id: { type: Orm.STRING, primaryKey: true },
	params: { type: Orm.TEXT,
		get() { return IdeasParamDict.newFromDbVal(this.getDataValue('params')) },
		set(val) { this.setDataValue('params', val.getAsDbVal()) }
	}
})

module.exports = { IdeasDb, IdeaSetsDb }

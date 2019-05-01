// DB model
const { orm, Orm } = Msa.require("db")
const { ideasParamsDef } = require("./params")

const IdeasDb = orm.define('msa_ideas', {
	key: { type: Orm.STRING, primaryKey: true },
	num: { type: Orm.INTEGER, primaryKey: true },
	parent: Orm.INTEGER,
	text: Orm.TEXT,
	createdBy: Orm.STRING,
	updatedBy: Orm.STRING
})

const IdeaSetsDb = orm.define('msa_idea_sets', {
	key: { type: Orm.STRING, primaryKey: true },
	params: { type: Orm.TEXT,
		get() { return ideasParamsDef.deserialize(this.getDataValue('params')) },
		set(val) { this.setDataValue('params', ideasParamsDef.serialize(val)) }
	}
})

module.exports = { IdeasDb, IdeaSetsDb }

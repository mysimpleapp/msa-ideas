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
		get() { const val = this.getDataValue('params'); return val ? ideasParamsDef.deserialize(val) : null },
		set(val) { if(val) val = ideasParamsDef.serialize(val); this.setDataValue('params', val) }
	}
})

module.exports = { IdeasDb, IdeaSetsDb }

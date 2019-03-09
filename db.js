// DB model
const { orm, Orm } = Msa.require("db")

const IdeasDb = orm.define('msa_ideas', {
	key: { type: Orm.STRING, primaryKey: true },
	num: { type: Orm.INTEGER, primaryKey: true },
	parent: Orm.INTEGER,
	text: Orm.TEXT,
	createdBy: Orm.STRING
})

module.exports = { IdeasDb }

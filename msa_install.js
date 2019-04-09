module.exports = async itf => {
	// create table in DB
	const { IdeasDb, IdeaSetsDb } = require("./db")
	await IdeasDb.sync()
	await IdeaSetsDb.sync()
}


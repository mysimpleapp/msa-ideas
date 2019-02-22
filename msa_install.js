module.exports = async itf => {
	// create table in DB
	const { IdeasDb } = require("./db")
	await IdeasDb.sync()
}


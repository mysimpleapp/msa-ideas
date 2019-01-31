module.exports = async (itf, next) => {
	try {
		// create table in DB
		await itf.installMsaMod("db", "msa-db")
		const { IdeasDb } = require("./db")
		await IdeasDb.sync()
	} catch(err) { return next(err) }
	next()
}


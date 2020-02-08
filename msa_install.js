module.exports = async itf => {
	// create table in DB
	const { withDb } = Msa.require('db')
	await withDb(async db => {
		await db.run(
			`CREATE TABLE IF NOT EXISTS msa_idea_sets (
				id VARCHAR(255) PRIMARY KEY,
				params TEXT
			)`)
		await db.run(
			`CREATE TABLE IF NOT EXISTS msa_ideas (
				id VARCHAR(255),
				num INTEGER,
				parent INTEGER,
				content TEXT,
				createdBy VARCHAR(255),
				updatedBy VARCHAR(255),
				PRIMARY KEY (id, num)
			)`)
	})
}


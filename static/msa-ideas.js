import { importHtml, importOnCall, Q, ajax } from "/utils/msa-utils.js"
import "/sheet/msa-sheet.js"
import "/vote/msa-vote.js"

const popupSrc = "/utils/msa-utils-popup.js"
const addPopup = importOnCall(popupSrc, "addPopup")
const addConfirmPopup = importOnCall(popupSrc, "addConfirmPopup")
const addInputPopup = importOnCall(popupSrc, "addInputPopup")
const textEditorSrc = "/utils/msa-utils-text-editor.js"
const makeTextEditable = importOnCall(textEditorSrc, "makeTextEditable")


importHtml(`<style>

	msa-ideas {
		padding: 1em;
	}

	msa-ideas .row {
		display: flex;
		flex-direction: row;
	}
	msa-ideas .col {
		display: flex;
		flex-direction: column;
	}
	msa-ideas .fill {
		flex: 1;
	}

	msa-ideas .admin input[type=image] {
		width: 2em;
		height: 2em;
		padding: .4em;
		margin-left: .5em;
		background: white;
		border-radius: .5em;
		box-shadow: 2px 2px 4px #555;
	}
	msa-ideas .admin input[type=image]:hover {
		background: lightgrey;
	}

	msa-ideas .intro {
		background: white;
	}

	msa-ideas .ideas {
		padding: .5em;
		align-items: stretch;
	}

	msa-ideas .idea {
		box-shadow: 2px 2px 4px #555;
		border-radius: .5em;
		padding: .4em;
		margin-top: 2em;
		background: white;
	}
	msa-ideas .idea:first-child {
		margin-top: .5em;
	}
	msa-ideas .sub-idea {
		margin-top: 1em;
	}

	msa-ideas .idea .content {
		margin: .6em;
	}

	msa-ideas .idea .btns {
		margin-top: .4em;
	}

	msa-ideas .idea .btns {
		display: flex;
	}
	msa-ideas .idea .btns input[type=image] {
		width: 1.2em;
		height: 1.2em;
		padding: .3em;
	}
	msa-ideas .idea .btns input[type=image]:hover {
		box-shadow: 2px 2px 4px #555;
	}
</style>`)

const template = `
	<div class="row">
		<p class="fill intro"></p>
		<p class="col admin" style="display:none">
			<input type="image" class="config" src="/utils/img/config">
		</p>
	</div>
	<p class="new_idea row" style="display: none">
		<input type="button" value="New idea">
	</p>
	<p class="ideas col"></p>
	<p class="load_ideas" style="text-align:center"><msa-loader></msa-loader></p>`


const ideaTemplate = `
	<div class="idea row">
		<div class="fill col">
			<div class="content fill" style="min-height:1em"></div>
			<div class="btns">
				<input type="image" class="edit" src="/utils/img/edit">
				<input type="image" class="rm" src="/utils/img/remove">
				<input type="image" class="suggest" src="/utils/img/add">
				<input type="image" class="save editing" src="/utils/img/save">
				<input type="image" class="cancel editing" src="/utils/img/cancel">
			</div>
		</div>
		<div class="vote row" style="align-items: center;"></div>
	</div>`

/*
const ideaEditorTemplate = `
	<div style="display:flex; flex-direction:column; min-width:20em; min-height:10em">
		<div class="editor"></div>
		<div class="content" style="flex: 1; outline: 1px dashed grey"></div>
	</div>`
*/

export class HTMLMsaIdeasElement extends HTMLElement {

	connectedCallback() {
		this.Q = Q
		this.baseUrl = this.getAttribute("base-url")
		this.ideasId = this.getAttribute("ideas-id")
		this.innerHTML = this.getTemplate()
		this.initActions()
		this.initIntro()
		this.getIdeas()
	}

	getTemplate() {
		return template
	}

	initActions() {
		this.Q(".config").onclick = () => this.popupConfig()
		const newIdeaInput = this.Q(".new_idea input")
		newIdeaInput.onclick = () => this.showNewIdea(true)
	}

	getIdeas() {
		this.clearIdeas()
		ajax("GET", `${this.baseUrl}/_list/${this.ideasId}`,
			{ loadingDom: this.Q(".load_ideas") })
			.then(({ ideas, votes, canAdmin, canCreateIdea }) => {
				this.initAdmin(canAdmin)
				this.initCreateIdea(canCreateIdea)
				this.initVotes(votes)
				this.initIdeas(ideas)
			})
	}

	initAdmin(canAdmin) {
		this.Q(".admin").style.display = canAdmin ? "" : "none"
	}

	initCreateIdea(canCreateIdea) {
		this.canCreateIdea = canCreateIdea
		showEl(this.Q(".new_idea"), canCreateIdea)
	}

	initIntro() {
		const sheet = document.createElement("msa-sheet")
		sheet.setAttribute("base-url", `${this.baseUrl}/_sheet/${this.ideasId}`)
		sheet.setAttribute("sheet-id", `intro`)
		sheet.setAttribute("fetch", "true")
		sheet.style.minHeight = "5em"
		sheet.style.border = "1px dashed grey"
		this.Q(".intro").appendChild(sheet)
	}

	initVotes(votes) {
		// store votes by id
		this.votes = votes.reduce((obj, vote) => {
			if (vote) obj[vote.id] = vote; return obj
		}, {})
	}

	clearIdeas() {
		this.Q(".ideas").innerHTML = ""
	}

	initIdeas(ideas) {
		// link ideas with their vote
		for (let idea of ideas)
			idea.vote = this.votes[`${idea.id}-${idea.num}`]
		// sort
		this.ideas = this.sortIdeas(ideas)
		// add
		this.clearIdeas()
		if (this.ideas.length > 0)
			this.addIdeas(this.ideas)
		else
			this.Q(".ideas").innerHTML = "<p style='text-align:center'>No idea</p>"
	}

	sortIdeas(ideas) {
		const sortedIdeas = []
		// save ideas by num id
		const ideasByNum = {}
		for (let idea of ideas)
			ideasByNum[idea.num] = idea
		// for each idea
		for (let idea of ideas) {
			// determine if idea has a parent
			// then deduce the array where to insert it
			let arr = sortedIdeas
			if (typeof idea.parent === "number") {
				const parentIdea = ideasByNum[idea.parent]
				arr = parentIdea ? initArr(parentIdea, "children") : null
			}
			if (arr !== null) orderedInsert(arr, idea, this.compareIdeas)
		}
		return sortedIdeas
	}

	// return true if idea1 is "greater" then idea2
	compareIdeas(idea1, idea2) {
		const vote1 = idea1.vote, vote2 = idea2.vote
		if (!vote1) return false
		if (vote1 && !vote2) return true
		const nb1 = vote1.nb, nb2 = vote2.nb
		if (!nb1) return false
		if (nb1 > 0 && !nb2) return true
		const score1 = vote1.sum / nb1, score2 = vote2.sum / nb2
		return score1 > score2
	}

	addIdeas(ideas, tab) {
		if (tab === undefined) tab = 0
		for (let idea of ideas) {
			this.Q(".ideas").appendChild(this.createIdea(idea, tab))
			if (idea.children) this.addIdeas(idea.children, tab + 1)
		}
	}

	createIdea(idea, tab) {
		const ideaEl = toEl(ideaTemplate)
		ideaEl.idea = idea
		if (tab === undefined) tab = 0
		ideaEl.ideaTab = tab
		// set tab
		ideaEl.style.marginLeft = (tab * 3) + "em"
		if (tab > 0) ideaEl.classList.add("sub-idea")
		// actions
		ideaEl.querySelector("input.suggest").onclick = () => this.showNewSuggestion(ideaEl, true)
		/*{
			addInputPopup(this, "What is your suggestion ?", {
				input: '<textarea rows="4" cols="50"></textarea>',
				validIf: val => val
			})
				.then(text => { if (text) this.postIdea({ text, parent: idea.num }) })
		}*/
		if (idea.canEdit) {
			ideaEl.querySelector("input.edit").onclick = () => {
				makeTextEditable(ideaEl.querySelector(".content"))
				idea.editing = true
				this.syncIdea(ideaEl)
			}
			ideaEl.querySelector("input.save").onclick = () => {
				const content = ideaEl.querySelector(".content")
				makeTextEditable(content, false)
				idea.content = content.innerHTML
				this.saveIdea(idea)
				idea.editing = false
				this.syncIdea(ideaEl)
				if (ideaEl.onEditEnd) ideaEl.onEditEnd()
			}
			ideaEl.querySelector("input.cancel").onclick = () => {
				makeTextEditable(ideaEl.querySelector(".content"), false)
				idea.editing = false
				this.syncIdea(ideaEl)
				if (ideaEl.onEditEnd) ideaEl.onEditEnd()
			}
		}
		if (idea.canRemove) {
			ideaEl.querySelector("input.rm").onclick = () => {
				addConfirmPopup(this, "Are you sur to remove this idea ?")
					.then(() => {
						ajax("DELETE", `${this.baseUrl}/_idea/${this.ideasId}/${idea.num}`)
							.then(() => this.getIdeas())
					})
			}
		}
		// add msa-vote
		if (idea.vote && idea.canRead) {
			const { sum, nb, canVote } = idea.vote
			const voteEl = document.createElement("msa-vote")
			voteEl.setAttribute("sum", sum)
			voteEl.setAttribute("nb", nb)
			voteEl.setAttribute("can-vote", canVote)
			voteEl.setAttribute("base-url", `${this.baseUrl}/_vote/${this.ideasId}`)
			voteEl.setAttribute("vote-id", idea.num)
			ideaEl.querySelector(".vote").appendChild(voteEl)
		}
		// sync
		this.syncIdea(ideaEl)
		// insert new idea
		return ideaEl
	}

	makeIdeaEditable(ideaEl) {
		const idea = ideaEl.idea
		makeTextEditable(ideaEl.querySelector(".content"))
		idea.editing = true
		this.syncIdea(ideaEl)
	}

	syncIdea(ideaEl) {
		const idea = ideaEl.idea
		ideaEl.querySelector(".content").innerHTML = idea.content || ""
		showEl(ideaEl.querySelector("input.edit"), idea.canEdit && !idea.editing)
		showEl(ideaEl.querySelector("input.rm"), idea.canRemove && !idea.editing)
		showEl(ideaEl.querySelector("input.suggest"), this.canCreateIdea && !idea.editing)
		showEl(ideaEl.querySelector("input.save"), idea.editing)
		showEl(ideaEl.querySelector("input.cancel"), idea.editing)
	}

	showNewIdea(val) {
		const newIdeaInput = this.Q(".new_idea input")
		showEl(newIdeaInput, !val)
		const newIdeaEl = this.querySelector(".ideas .new")
		if (val && !newIdeaEl) {
			const idea = { canRead: true, canEdit: true }
			const ideaEl = this.createIdea(idea)
			ideaEl.classList.add("new")
			ideaEl.onEditEnd = () => this.showNewIdea(false)
			prependChild(this.Q(".ideas"), ideaEl)
			this.makeIdeaEditable(ideaEl)
		}
		if (!val && newIdeaEl) newIdeaEl.remove()
	}

	showNewSuggestion(parentIdeaEl, val) {
		const suggestInput = parentIdeaEl.querySelector("input.suggest")
		showEl(suggestInput, !val)
		const newSuggestEl = parentIdeaEl.newSuggestEl
		if (val && !newSuggestEl) {
			const idea = { canRead: true, canEdit: true, parent: parentIdeaEl.idea.num }
			const ideaEl = this.createIdea(idea, parentIdeaEl.ideaTab + 1)
			parentIdeaEl.newSuggestEl = ideaEl
			ideaEl.onEditEnd = () => this.showNewSuggestion(parentIdeaEl, false)
			this.querySelector(".ideas").insertBefore(ideaEl, parentIdeaEl.nextSibling)
			this.makeIdeaEditable(ideaEl)
		}
		if (!val && newSuggestEl) {
			newSuggestEl.remove()
			delete parentIdeaEl.newSuggestEl
		}
	}

	async postNewIdea() {
		const input = this.Q(".new_idea input[type=text]")
		const content = input.value
		await this.postIdea({ content })
		input.value = ""
	}
	/*
		async postIdea(body) {
			await ajax("POST", `${this.baseUrl}/_idea/${this.ideasId}`, {
				body,
				loadingDom: this.Q(".new_idea")
			})
			this.getIdeas()
		}
	
		async updateIdea(num, body) {
			await ajax("POST", `${this.baseUrl}/_idea/${this.ideasId}/${num}`, {
				body,
				loadingDom: this.Q(".new_idea")
			})
			this.getIdeas()
		}
	*/
	async saveIdea(idea) {
		let path = `${this.baseUrl}/_idea/${this.ideasId}`
		if (idea.num !== undefined)
			path += `/${idea.num}`
		await ajax("POST", path, {
			body: { parent: idea.parent, content: idea.content },
			loadingDom: this.Q(".new_idea")
		})
		this.getIdeas()
	}
	/*
		async popupIdeaEditor(idea) {
			const tmpl = document.createElement("template")
			tmpl.innerHTML = ideaEditorTemplate
			const popup = await addPopup(this, tmpl.content.children[0])
			console.log("TMP popup", popup)
			makeTextEditable(popup.content.querySelector(".content"), popup.content.querySelector(".editor"))
		}
	*/
	popupConfig() {
		import("/params/msa-params-admin.js")
		const paramsEl = document.createElement("msa-params-admin")
		paramsEl.setAttribute("base-url", `${this.baseUrl}/_params/${this.ideasId}`)
		addPopup(this, paramsEl)
	}
}

customElements.define("msa-ideas", HTMLMsaIdeasElement)

// utils

function toEl(html) {
	const t = document.createElement("template")
	t.innerHTML = html
	return t.content.children[0]
}

function initArr(obj, key) {
	let arr = obj[key]
	if (arr === undefined) arr = obj[key] = []
	return arr
}

function showEl(el, val) {
	el.style.display = val ? "" : "none"
}

function prependChild(parent, el) {
	const children = parent.children
	if (children.length === 0)
		parent.appendChild(el)
	else
		parent.insertBefore(el, children[0])
}

function orderedInsert(arr, item, comparator) {
	for (let i = 0, len = arr.length; i < len; i++) {
		if (comparator(item, arr[i])) {
			arr.splice(i, 0, item)
			return
		}
	}
	arr.push(item)
}

import { importHtml, importOnCall, Q, ajax } from "/utils/msa-utils.js"
import "/sheet/msa-sheet.js"
import "/vote/msa-vote.js"

const popupSrc = "/utils/msa-utils-popup.js"
const addPopup = importOnCall(popupSrc, "addPopup")
const addConfirmPopup = importOnCall(popupSrc, "addConfirmPopup")
const addInputPopup = importOnCall(popupSrc, "addInputPopup")


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

	msa-ideas .idea .text {
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
		<input placeholder="New idea" type="text" class="fill"></input>
		&nbsp;
		<button style="position: relative">
			<msa-loader style="position: absolute; width:1em; height:1em"></msa-loader>
			<span class="msa-loading-invisible">Send</span>
		</button>
	</p>
	<p class="ideas col"></p>
	<p class="load_ideas" style="text-align:center"><msa-loader></msa-loader></p>`



const ideaTemplate = `
	<div class="idea row">
		<div class="fill col">
			<div class="text fill"></div>
			<div class="btns">
				<input type="image" class="edit" src="/utils/img/edit">
				<input type="image" class="rm" src="/utils/img/remove">
				<input type="image" class="suggest" src="/utils/img/add">
			</div>
		</div>
		<div class="vote row" style="align-items: center;"></div>
	</div>`

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

	getTemplate(){
		return template
	}

	initActions(){
		this.Q(".config").onclick = () => this.popupConfig()
		this.Q(".new_idea button").onclick = () => this.postNewIdea()
	}

	getIdeas(){
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

	initAdmin(canAdmin){
		this.Q(".admin").style.display = canAdmin ? "" : "none"
	}

	initCreateIdea(canCreateIdea){
		this.canCreateIdea = canCreateIdea
		const dom = this.Q(".new_idea")
		dom.style.display = canCreateIdea ? "" : "none"
	}

	initIntro(){
		const sheet = document.createElement("msa-sheet")
		sheet.setAttribute("base-url", `${this.baseUrl}/_sheet/${this.ideasId}`)
		sheet.setAttribute("key", `intro`)
		sheet.setAttribute("fetch", "true")
		sheet.style.minHeight = "5em"
		sheet.style.border = "1px dashed grey"
		this.Q(".intro").appendChild(sheet)
	}

	initVotes(votes){
		// store votes by id
		this.votes = votes.reduce((obj, vote) => {
			obj[vote.id] = vote; return obj
		}, {})
	}

	clearIdeas(){
		this.Q(".ideas").innerHTML = ""
	}

	initIdeas(ideas){
		// link ideas with their vote
		for(let idea of ideas)
			idea.vote = this.votes[`${idea.id}-${idea.num}`]
		// sort
		this.ideas = this.sortIdeas(ideas)
		// add
		this.clearIdeas()
		if(this.ideas.length > 0)
			this.addIdeas(this.ideas)
		else
			this.Q(".ideas").innerHTML = "<p style='text-align:center'>No idea</p>"
	}

	sortIdeas(ideas){
		const sortedIdeas = []
		// save ideas by num id
		const ideasByNum = {}
		for(let idea of ideas)
			ideasByNum[idea.num] = idea
		// for each idea
		for(let idea of ideas){
			// determine if idea has a parent
			// then deduce the array where to insert it
			let arr = sortedIdeas
			if(typeof idea.parent === "number"){
				const parentIdea = ideasByNum[idea.parent]
				arr = parentIdea ? initArr(parentIdea, "children") : null
			}
			if(arr !== null) orderedInsert(arr, idea, this.compareIdeas)
		}
		return sortedIdeas
	}

	// return true if idea1 is "greater" then idea2
	compareIdeas(idea1, idea2){
		const vote1 = idea1.vote, vote2 = idea2.vote
		if(!vote1) return false
		if(vote1 && !vote2) return true
		const nb1 = vote1.nb, nb2 = vote2.nb
		if(!nb1) return false
		if(nb1>0 && !nb2) return true
		const score1 = vote1.sum/nb1, score2 = vote2.sum/nb2
		return score1 > score2
	}

	addIdeas(ideas, tab){
		if(tab===undefined) tab=0
		for(let idea of ideas){
			this.addIdea(idea, tab)
			if(idea.children) this.addIdeas(idea.children, tab+1)
		}
	}

	addIdea(idea, tab){
		const ideaEl = toEl(ideaTemplate)
		ideaEl.idea = idea
		// set tab
		ideaEl.style.marginLeft = (tab*3)+"em"
		if(tab>0) ideaEl.classList.add("sub-idea")
		// set text
		ideaEl.querySelector(".text").textContent = idea.text
		// actions
		ideaEl.querySelector("input.suggest").onclick = () => {
			addInputPopup(this, "What is your suggestion ?", {
				input: '<textarea rows="4" cols="50"></textarea>',
				validIf: val => val
			})
			.then(text => { if(text) this.postIdea({ text, parent:idea.num }) })
		}
		if(idea.canEdit) {
			ideaEl.querySelector("input.edit").onclick = () => {
				alert("Not implemented !")
			}
		} else {
			ideaEl.querySelector("input.edit").style.display = "none"
		}
		if(idea.canRemove) {
			ideaEl.querySelector("input.rm").onclick = () => {
				addConfirmPopup(this, "Are you sur to remove this idea ?")
				.then(() => {
					ajax("DELETE", `${this.baseUrl}/_idea/${this.ideasId}/${idea.num}`)
					.then(() => this.getIdeas())
				})
			}
		} else {
			ideaEl.querySelector("input.rm").style.display = "none"
		}
		if(this.canCreateIdea) {
		} else {
			ideaEl.querySelector("input.suggest").style.display = "none"
		}
		// add msa-vote
		if(idea.vote && idea.canRead){
			const { sum, nb, canVote } = idea.vote
			const voteEl = document.createElement("msa-vote")
			voteEl.setAttribute("sum", sum)
			voteEl.setAttribute("nb", nb)
			voteEl.setAttribute("can-vote", canVote)
			voteEl.setAttribute("base-url", `${this.baseUrl}/_vote/${this.ideasId}`)
			voteEl.setAttribute("vote-id", idea.num)
			ideaEl.querySelector(".vote").appendChild(voteEl)
		}
		// insert new idea
		this.Q(".ideas").appendChild(ideaEl)
	}

	postNewIdea(){
		const input = this.Q(".new_idea input[type=text]")
		const text = input.value
		this.postIdea({ text }, () => input.value = "")
	}

	postIdea(body, next){
		ajax("POST", `${this.baseUrl}/_idea/${this.ideasId}`, {
			body,
			loadingDom: this.Q(".new_idea")
		})
		.then(() => {
			this.getIdeas()
			next && next()
		})
	}

	popupConfig(){
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

function initArr(obj, key){
	let arr = obj[key]
	if(arr === undefined) arr = obj[key] = []
	return arr
}

function orderedInsert(arr, item, comparator){
	for(let i=0, len=arr.length; i<len; i++){
		if(comparator(item, arr[i])){
			arr.splice(i, 0, item)
			return
		}
	}
	arr.push(item)
}

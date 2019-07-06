import { importHtml, Q, ajax } from "/msa/msa.js"
import "/sheet/msa-sheet.js"
import "/vote/msa-vote.js"
import { createPopup, createConfirmPopup, createInputPopup } from "/utils/msa-utils-popup.js"
import "/params/msa-params-admin.js"

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

	msa-ideas .idea .btns button {
		font-size: .7em;
		padding: .3em;
		border-width: thin;
		background-color: #f9f9f9;
	}
</style>`)

const content = `
	<p class="admin" style="display:none"><button class="config">Config</button></p>
	<p class="intro"></p>
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



const ideaHtml = `
	<div class="idea row">
		<div class="fill col">
			<div class="text fill"></div>
			<div class="btns">
				<button class="edit">Edit</button>
				<button class="rm">Remove</button>
				<button class="propose">Add suggestion</button>
			</div>
		</div>
		<div class="vote row" style="align-items: center;"></div>
	</div>`

export class HTMLMsaIdeasElement extends HTMLElement {

	connectedCallback() {
		this.Q = Q
		this.baseUrl = this.getAttribute("base-url")
		this.key = this.getAttribute("key")
		this.initContent()
		this.initActions()
		this.initIntro()
		this.getIdeas()
	}

	initContent(){
		this.innerHTML = content
	}

	initActions(){
		this.Q(".config").onclick = () => this.popupConfig()
		this.Q(".new_idea button").onclick = () => this.postNewIdea()
	}

	getIdeas(){
		this.clearIdeas()
		ajax("GET", `${this.baseUrl}/_list/${this.key}`,
			{ loadingDom: this.Q(".load_ideas") },
			({ ideas, votes, canAdmin, canCreateIdea }) => {
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
		sheet.setAttribute("base-url", `${this.baseUrl}/_sheet/${this.key}`)
		sheet.setAttribute("key", `intro`)
		sheet.setAttribute("fetch", "true")
		sheet.style.minHeight = "5em"
		sheet.style.border = "1px dashed grey"
		this.Q(".intro").appendChild(sheet)
	}

	initVotes(votes){
		// store votes by key
		this.votes = votes.reduce((obj, vote) => {
			obj[vote.key] = vote; return obj
		}, {})
	}

	clearIdeas(){
		this.Q(".ideas").innerHTML = ""
	}

	initIdeas(ideas){
		// link ideas with their vote
		for(let idea of ideas)
			idea.vote = this.votes[`${idea.key}-${idea.num}`]
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
		// save ideas by num key
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
		const ideaEl = toEl(ideaHtml)
		ideaEl.idea = idea
		// set tab
		ideaEl.style.marginLeft = (tab*3)+"em"
		if(tab>0) ideaEl.classList.add("sub-idea")
		// set text
		ideaEl.querySelector(".text").textContent = idea.text
		// actions
		ideaEl.querySelector("button.propose").onclick = () => {
			createInputPopup("What is your proposition ?", text => {
				this.postIdea({ text, parent:idea.num })
			})
		}
		if(idea.canEdit) {
			ideaEl.querySelector("button.edit").onclick = () => {
				alert("Not implemented !")
			}
		} else {
			ideaEl.querySelector("button.edit").style.display = "none"
		}
		if(idea.canRemove) {
			ideaEl.querySelector("button.rm").onclick = () => {
				createConfirmPopup("Are you sur to remove this idea ?", () => {
					ajax("DELETE", `${this.baseUrl}/_idea/${this.key}/${idea.num}`, () => {
						this.getIdeas()
					})
				})
			}
		} else {
			ideaEl.querySelector("button.rm").style.display = "none"
		}
		if(this.canCreateIdea) {
		} else {
			ideaEl.querySelector("button.propose").style.display = "none"
		}
		// add msa-vote
		if(idea.vote && idea.canRead){
			const { sum, nb, canVote } = idea.vote
			const voteEl = document.createElement("msa-vote")
			voteEl.setAttribute("sum", sum)
			voteEl.setAttribute("nb", nb)
			voteEl.setAttribute("can-vote", canVote)
			voteEl.setAttribute("base-url", `${this.baseUrl}/_vote/${this.key}`)
			voteEl.setAttribute("key", idea.num)
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
		ajax("POST", `${this.baseUrl}/_idea/${this.key}`,
			{
				body,
				loadingDom: this.Q(".new_idea")
			},
			() => {
				this.getIdeas()
				next && next()
			})
	}

	popupConfig(){
		const paramsEl = document.createElement("msa-params-admin")
		paramsEl.setAttribute("base-url", `${this.baseUrl}/_params/${this.key}`)
		createPopup(paramsEl)
	}
}

customElements.define("msa-ideas", HTMLMsaIdeasElement)

// various

function toEl(html) {
	const t = document.createElement("template")
	t.innerHTML = ideaHtml
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

import { importHtml, Q, ajax } from "/msa/msa.js"
import "/vote/msa-vote.js"
import { createConfirmPopup, createInputPopup } from "/utils/msa-utils-popup.js"

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

	msa-ideas .idea {
		border: 1px dashed grey;
		padding: .4em;
		margin: 1em 0;
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


msa-loader {
  display: inline-block;
  height: 1.5em;
  width: 1.5em;
  background-position: center center;
  background-repeat: no-repeat;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' style='fill:none; stroke:black; stroke-width:15'><path d='M15,50 a1,1 0 0,0 70,0' /></svg>");
  animation: msa-loader-spin 1s linear infinite;
}

@keyframes msa-loader-spin {
	from{transform:rotate(0deg)}
	to{transform:rotate(360deg)}	
}

</style>`)

const content = `
	<p class="new_idea row">
		<input placeholder="New idea" type="text" class="fill"></input>
		&nbsp;
		<button>Send</button>
	</p>
	<p class="ideas">
		<center>
			<msa-loader style="width:2em; height:2em; margin: 1em"></msa-loader>
		</center>
	</p>`

const ideaHtml = `
	<div class="idea row">
		<div class="fill col">
			<div class="text fill"></div>
			<div class="btns">
				<button class="propose">Propose</button>
				<button class="edit">Edit</button>
				<button class="rm">Remove</button>
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
		this.getIdeas()
	}

	initContent(){
		this.innerHTML = content
	}

	initActions(){
		this.Q(".new_idea button").onclick = () => this.postNewIdea()
	}

	getIdeas(){
		ajax("GET", `${this.baseUrl}/_list/${this.key}`, ({ ideas, votes }) => {
			this.initVotes(votes)
			this.initIdeas(ideas)
		})
	}

	initVotes(votes){
		// store votes by key
		this.votes = votes.reduce((obj, vote) => {
			obj[vote.key] = vote; return obj
		}, {})
	}

	initIdeas(ideas){
		// link ideas with their vote
		for(let idea of ideas)
			idea.vote = this.votes[`${idea.key}-${idea.num}`]
		// sort
		this.ideas = this.sortIdeas(ideas)
		// add
		this.Q(".ideas").innerHTML = ""
		this.addIdeas(this.ideas)
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
		ideaEl.style.marginLeft = tab+"em"
		// set text
		ideaEl.querySelector(".text").textContent = idea.text
		// actions
		ideaEl.querySelector("button.propose").onclick = () => {
			createInputPopup("What is your proposition ?", text => {
				this.postIdea({ text, parent:idea.num })
			})
		}
		ideaEl.querySelector("button.edit").onclick = () => {
			alert("Not implemented !")
		}
		ideaEl.querySelector("button.rm").onclick = () => {
			createConfirmPopup("Are you sur to remove this idea ?", () => {
				ajax("DELETE", `${this.baseUrl}/_idea/${this.key}/${idea.num}`, () => {
					this.getIdeas()
				})
			})
		}
		// add msa-vote
		const vote = idea.vote
		const voteEl = document.createElement("msa-vote")
		if(this.votes) {
			const { sum=0, nb=0 } = idea.vote || {}
			voteEl.setAttribute("sum", sum)
			voteEl.setAttribute("nb", nb)
		}
		voteEl.setAttribute("base-url", `${this.baseUrl}/_vote`)
		voteEl.setAttribute("key", `${this.key}-${idea.num}`)
		ideaEl.querySelector(".vote").appendChild(voteEl)
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
			{ body },
			() => {
				this.getIdeas()
				next && next()
			})
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

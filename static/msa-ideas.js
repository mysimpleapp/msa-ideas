import { importHtml, Q, ajax } from "/msa/msa.js"
import "/vote/msa-vote.js"

importHtml(`<style>

	msa-ideas {
		padding: 1em;
	}

	msa-ideas .idea {
		border: 1px dashed grey;
		padding: 1em;
		display: flex;
		flex-direction: row;
	}

	msa-ideas .idea .text {
		flex: 1;
	}
</style>`)

const content = `
	<p class="new_idea"><input type="text" placeholder="New idea"></input> <button>Send</button></p>
	<p class="ideas"></p>`

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
		ajax("GET", `${this.baseUrl}/_list/${this.key}`, ideas =>
			this.initIdeas(ideas))
	}

	initIdeas(ideas){
		this.ideas = ideas
		this.Q(".ideas").innerHTML = ""
		for(let idea of ideas)
			this.addIdea(idea)
	}

	addIdea(idea){
		const ideaEl = newEl(this.Q(".ideas"), "p", { class:"idea" })
		newEl(ideaEl, "div", { class:"text", text:idea.text })
		const voteEl = newEl(ideaEl, "msa-vote", { attrs:{
			"base-url": `${this.baseUrl}/_vote`,
			"key": `${this.key}-${idea.num}`
		}})
	}

	postNewIdea(){
		const input = this.Q(".new_idea input[type=text]")
		const newIdea = input.value
		ajax("POST", `${this.baseUrl}/_idea/${this.key}`,
			{ body:{ text:newIdea }},
			() => {
				this.getIdeas()
				input.value = ""
			})
	}
}

customElements.define("msa-ideas", HTMLMsaIdeasElement)

// various

function newEl(parentNode, tag, kwargs) {
	const dom = document.createElement(tag)
	if(kwargs.class)
		dom.className = kwargs.class
	if(kwargs.text)
		dom.textContent = kwargs.text
	if(kwargs.attrs)
		for(let att in kwargs.attrs)
			dom.setAttribute(att, kwargs.attrs[att])
	parentNode.appendChild(dom)
	return dom
}

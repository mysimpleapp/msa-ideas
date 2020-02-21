export function createSheetBox(sheet) {
    const baseUrl = sheet.getAttribute("base-url")
    const sheetId = sheet.getAttribute("sheet-id")
    let id = 0
    while (true) {
        id += 1
        if (findChild(sheet, el => el.tagName === "MSA-IDEAS" && el.getAttribute("ideas-id") == id))
            continue
        break
    }
    return {
        wel: "/ideas/msa-ideas.js",
        attrs: {
            "base-url": `${baseUrl}/${sheetId}/box/ideas`,
            "ideas-id": id
        }
    }
}

export function exportSheetBox(el) {
    const attrs = {}
    for (let a of el.attributes) if (a.nodeValue) attrs[a.nodeName] = a.nodeValue
    return {
        wel: "/ideas/msa-ideas.js",
        attrs
    }
}

function findChild(el, matcher) {
    if (matcher(el)) return el
    for (let c of el.children) {
        const r = findChild(c, matcher)
        if (r) return r
    }
}
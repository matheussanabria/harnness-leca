// @ts-check
// Keeps DC control-flow nodes valid when the browser parses table content.

/** @param {string} html */
function tableSafeDcTemplate(html) {
  return html.replace(/<(\/?)sc-(for|if)\b([^>]*)>/gi, (full, close, kind, attrs) => (
    close ? "</template>" : `<template data-dc-control="sc-${kind.toLowerCase()}"${attrs}>`
  ));
}

module.exports = { tableSafeDcTemplate };

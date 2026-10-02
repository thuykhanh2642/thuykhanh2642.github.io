---
name: Khanh Nguyen Conversations
description: Private conversation inbox within the portfolio's Field Notes visual world.
colors:
  bg: "#101412"
  panel: "#18201a"
  text: "#f3f1e7"
  muted: "#b3b7a8"
  line: "#374238"
  accent: "#a8d99c"
  accent-ink: "#122014"
  soft: "#202a22"
  light-bg: "#faf8f0"
  light-panel: "#fffffc"
  light-text: "#22291f"
  light-muted: "#5e675c"
  light-line: "#dce1d5"
  light-accent: "#356942"
  light-accent-ink: "#fff"
  light-soft: "#f0efe7"
typography:
  display:
    fontFamily: "DM Serif Display, Georgia, serif"
    fontSize: "clamp(2.5rem, 5vw, 4rem)"
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "-.025em"
  headline:
    fontFamily: "DM Serif Display, Georgia, serif"
    fontSize: "1.7rem"
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "-.025em"
  body:
    fontFamily: "DM Sans, sans-serif"
    fontSize: "1rem"
    lineHeight: 1.6
  metadata:
    fontFamily: "DM Sans, sans-serif"
    fontSize: ".85rem"
rounded:
  control: "8px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.control}"
    padding: ".5rem .9rem"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: ".5rem .9rem"
  input:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: ".6rem .8rem"
  visit-selected:
    backgroundColor: "{colors.soft}"
    textColor: "{colors.text}"
    padding: "1rem .7rem"
---

# Design System: Khanh Nguyen Conversations

## Overview

**Creative North Star: "Field Notes"**

This document applies only to the private dashboard at `worker/public/admin/`. It extends the existing portfolio identity; the root `DESIGN.md` remains the authority for public portfolio surfaces.

Forest ink, warm paper, and moss give the inbox the same editorial character as the portfolio. A plain header, ruled visit list, and spacious transcript keep actual questions and replies central.

**Key Characteristics:**
- Editorial serif headings with readable sans-serif content.
- Flat surfaces and thin rules.
- Dark and light themes with equivalent semantic roles.

## Colors

### Primary

Moss accent marks the primary action, selected visit outline, focus indication, and transcript speaker labels. Accent ink supplies contrast inside the primary button.

### Neutral

Forest ink background and panel roles support warm paper text. Muted text carries dates and secondary descriptions; line separates regions and records; soft marks interactive hover and selection. The light theme maps these same roles to warm paper surfaces and dark text.

**The Semantic Pairing Rule.** Switch all roles together when changing theme; retain the text/accent-ink pairing appropriate to each surface.

## Typography

**Display Font:** DM Serif Display, with Georgia and serif fallbacks.
**Body Font:** DM Sans, with sans-serif fallback.

The large page title leads into smaller serif section headings. Body text remains full-sized; metadata is subordinate. Section headings reduce to 1.5rem on narrow screens. Introductory paragraphs have a maximum measure of 72ch.

**The Transcript Legibility Rule.** Questions and replies use body typography, preserve line breaks, and wrap long strings. Speaker labels and timestamps remain visually secondary.

## Layout

Header and main share a centered container capped at 1180px, with 3rem total horizontal clearance. The inbox uses a narrow visit column and a transcript column at a .9:1.8 ratio, separated by a vertical rule. Main top spacing scales from 2rem to 4rem.

At 720px and below, horizontal clearance becomes 2rem and the inbox stacks. The visit list scrolls within a 22rem maximum height; the transcript follows beneath a horizontal rule. Search controls may wrap. The sign-in form stays within 30rem and search within 36rem.

## Elevation & Depth

There are no shadows. Thin separators, panel tones, and the soft selected-row fill establish hierarchy. Focus uses an accent outline with a 4px offset; selected visits use an inset accent outline.

**The Ruled Surface Rule.** Use separators and tonal states to organize the inbox rather than elevated cards.

## Shapes

Controls have gently rounded corners using the control radius. Visit rows are square and span the list width. Transcript records remain open blocks separated by rules.

## Components

### Buttons

Text buttons use transparent surfaces and line borders; hover adds soft fill and an accent border. The sign-in action uses moss fill and accent ink. Controls have a 44px minimum height. Disabled buttons reduce opacity and show a waiting cursor.

### Inputs / Fields

Fields use the panel surface, line border, full available width, and the shared control radius. Visible labels precede fields. Placeholder text uses the muted role. Keyboard focus uses the shared accent outline.

### Navigation

A plain name link anchors the header. Theme and sign-out actions sit beside it and wrap with the header on narrow screens. Theme choice is immediate and remembered for this dashboard using the portfolio's same preference-key convention; preferences remain local to each origin.

### Visit List

Each row leads with the first question, followed by local date, question count, and failure count when present. A soft fill and inset accent outline identify the selected visit; selection is also exposed through `aria-pressed`.

### Transcript

Each ruled record includes a timestamp, explicit speaker labels, and plain text message bodies. Failed replies use muted text while retaining a clear failure label. Loading and empty states use readable text, and status changes are announced. Selecting a visit moves focus to its transcript heading; narrow screens also bring the transcript into view.

## Do's and Don'ts

### Do:
- **Do** inherit Field Notes typography and semantic theme roles within this dashboard.
- **Do** keep questions and replies readable, with preserved line breaks and wrapping.
- **Do** show selection, focus, loading, empty, and failure states explicitly.

### Don't:
- **Don't** turn the visit list or transcript into repeated elevated cards.
- **Don't** add decorative motion or ornamental dashboard metrics.
- **Don't** apply this private inbox composition to public portfolio pages.

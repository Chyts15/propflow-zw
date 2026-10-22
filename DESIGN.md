---
name: PropFlow Zimbabwe
description: Rent, proof and complaints for Zimbabwean landlords and tenants, in a warm terracotta-and-teal system built for small phones.
colors:
  primary: "#c8522a"
  primary-light: "#e8835c"
  primary-deep: "#9a3a1a"
  secondary: "#0e7c6b"
  secondary-light: "#1aaf97"
  secondary-deep: "#085548"
  gold: "#d4a017"
  gold-light: "#ecc94b"
  night-earth: "#0e0704"
  hearth: "#150b07"
  ember-card: "#1f130d"
  ember-line: "#3a2216"
  forest-night: "#04140f"
  forest-hearth: "#062018"
  forest-card: "#0e2a20"
  forest-line: "#1a3d30"
  stone-50: "#faf8f5"
  stone-100: "#f2ede6"
  stone-200: "#e4d9cc"
  stone-400: "#9e8e7e"
  stone-600: "#5c4a38"
  stone-800: "#2e2218"
  stone-900: "#1a1208"
  success: "#16a34a"
  warning: "#d97706"
  danger: "#dc2626"
  info: "#0369a1"
  on-dark-success: "#4ade80"
  on-dark-warning: "#fbbf24"
  on-dark-danger: "#f87171"
  on-dark-info: "#60a5fa"
  complaint-fill-critical: "#3d1311"
  complaint-fill-high: "#3b1f10"
  complaint-fill-medium: "#33270e"
  complaint-fill-low: "#1f130d"
  underglow-critical: "#dc2626"
  underglow-high: "#ea580c"
  underglow-medium: "#ca8a04"
  ecocash: "#00a850"
  onemoney: "#e30613"
  innbucks: "#f7a800"
typography:
  display:
    fontFamily: "Plus Jakarta Sans, Inter, sans-serif"
    fontSize: "3rem"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "normal"
  headline:
    fontFamily: "Plus Jakarta Sans, Inter, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 800
    lineHeight: 1.2
    letterSpacing: "normal"
  title:
    fontFamily: "Plus Jakarta Sans, Inter, sans-serif"
    fontSize: "1.0625rem"
    fontWeight: 800
    lineHeight: 1.3
    letterSpacing: "normal"
  body:
    fontFamily: "Inter, Arial, Helvetica, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.6875rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.025em"
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "6px 12px"
  button-action:
    backgroundColor: "{colors.primary-light}"
    textColor: "#ffffff"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "6px 12px"
  card:
    backgroundColor: "{colors.ember-card}"
    textColor: "#ffffff"
    rounded: "{rounded.2xl}"
    padding: "16px"
  card-hero:
    backgroundColor: "{colors.ember-card}"
    textColor: "#ffffff"
    rounded: "{rounded.2xl}"
    padding: "24px"
  complaint-card-critical:
    backgroundColor: "{colors.complaint-fill-critical}"
    textColor: "#ffffff"
    rounded: "{rounded.2xl}"
    padding: "12px"
  nav-item:
    textColor: "rgba(255, 255, 255, 0.55)"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
  nav-item-active:
    backgroundColor: "rgba(200, 82, 42, 0.1)"
    textColor: "{colors.primary}"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
  chip-filter:
    backgroundColor: "{colors.ember-card}"
    textColor: "rgba(255, 255, 255, 0.55)"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
  chip-filter-active:
    backgroundColor: "{colors.primary}"
    textColor: "#ffffff"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
  badge-status:
    rounded: "{rounded.full}"
    padding: "2px 8px"
  input-search:
    backgroundColor: "{colors.ember-card}"
    textColor: "#ffffff"
    rounded: "{rounded.lg}"
    padding: "8px 12px 8px 32px"
---

# Design System: PropFlow Zimbabwe

## Overview

**Creative North Star: "The Msasa Rent Roll"**

A rent roll is the record a landlord actually trusts: who owes what, who has paid, what is broken. The Msasa Rent Roll is that record made warm and local. It borrows its colors from the Zimbabwean landscape already named in the code (Msasa terracotta, Victoria Falls teal, Savanna gold) and sets them on deep espresso grounds, so the interface reads like a well-kept ledger read at dusk rather than a generic dashboard. Terracotta marks what needs a landlord's attention, teal marks the tenant's side, and gold is held in reserve.

The system is dense where landlords scan (rent rows, stat tiles, complaint queues) and generous where tenants act on a small phone (large type, soft shapes, clear single actions). Controls should feel warm and tactile: rounded, filled with tonal color rather than outlined, and responsive to touch. Depth is quiet. Cards are flat tonal layers; the only glow in the product is the soft underlight on a complaint card that signals urgency.

The shipped theme is dark: espresso for landlords, forest for tenants. A light theme (terracotta `primary-deep` sidebar, warm `stone-50` main) is approved in the design deck and its tokens exist in `app/globals.css`, but the landlord and tenant shells render the dark theme only today.

**Key Characteristics:**
- Warm near-black grounds with a single terracotta voice (landlord) or teal voice (tenant), never cold grey.
- Mono, uppercase micro-labels for eyebrows, amounts, references and actions; heavy geometric headings for the numbers that matter.
- Flat tonal cards with a 1px warm border; urgency alone earns a colored underglow.
- Money always reads in both currencies, and payment method and status are always visible as small pills.
- Mobile-first: bottom tab bar, compact stat labels, fixed top bar, skeletons instead of spinners.

## Colors

A warm, earthy palette: terracotta and teal as two equal-weight brand voices over espresso and forest grounds, with a small gold accent held back.

### Primary
- **Msasa Terracotta** (`primary`, #c8522a): the landlord voice. Active navigation, filled chips, primary actions, the logo's house shape, the proof-pending row tint, and the avatar fill.
- **Msasa Glow** (`primary-light`, #e8835c): the lighter terracotta for "do this now" actions such as Mark Paid, and for the active-card outline.
- **Burnt Msasa** (`primary-deep`, #9a3a1a): the light-theme landlord sidebar, and the hover state of terracotta buttons.

### Secondary
- **Victoria Falls Teal** (`secondary`, #0e7c6b): the tenant voice. Tenant accent, resolved states, and the logo's roof facet.
- **Falls Mist** (`secondary-light`, #1aaf97): the lighter teal for tenant highlights.
- **Deep Falls** (`secondary-deep`, #085548): the light-theme tenant sidebar.

### Tertiary
- **Savanna Gold** (`gold`, #d4a017) and **Gold Light** (`gold-light`, #ecc94b): a reserved accent. In the shadcn token map, gold-light is the generic accent fill. Use sparingly.

### Neutral
- **Night Earth** (`night-earth`, #0e0704): landlord main background.
- **Hearth** (`hearth`, #150b07): landlord sidebar, top bar, bottom bar, and the complaint list panel; also the PWA theme color.
- **Ember Card** (`ember-card`, #1f130d): landlord card and control surface.
- **Ember Line** (`ember-line`, #3a2216): the 1px border on landlord cards and the low-priority complaint tone.
- **Forest Night** (`forest-night`, #04140f), **Forest Hearth** (`forest-hearth`, #062018), **Forest Card** (`forest-card`, #0e2a20), **Forest Line** (`forest-line`, #1a3d30): the same four roles for the tenant shell.
- **Stone ramp** (`stone-50` #faf8f5 to `stone-900` #1a1208): warm light-theme neutrals. `stone-50` is the light-theme page ground, `stone-200` the light border, `stone-600` muted text.
- **Text on dark:** white at full strength for primary text, 55% for secondary, 35% for faint or disabled.

### Status and payment colors
- **Status text on dark** (`on-dark-success` #4ade80, `on-dark-warning` #fbbf24, `on-dark-danger` #f87171, `on-dark-info` #60a5fa) is paired with the same hue at 15 to 18% opacity as a pill fill. Solid `success`, `warning`, `danger`, `info` are the light-theme equivalents.
- **Complaint priority** is carried by two separate tokens. The card fill is a dark tone of the priority's hue, so white text keeps its contrast: `complaint-fill-critical` #3d1311, `complaint-fill-high` #3b1f10, `complaint-fill-medium` #33270e, `complaint-fill-low` #1f130d. The underglow is the brighter hue of the same family: `underglow-critical` #dc2626, `underglow-high` #ea580c, `underglow-medium` #ca8a04. Low priority has no visible glow. Resolved and closed cards take the low fill and no glow. The priority is also written on the card ("HIGH · OPEN"), so color is never the only signal.
- **Payment methods** use their real brand colors as tints: EcoCash `ecocash`, OneMoney `onemoney`, InnBucks `innbucks`; Bank uses a blue tint; cash is a neutral white tint.

### Named Rules
**The One Voice Rule.** Each portal has one brand voice: terracotta for landlords, teal for tenants. They never share a screen as competing accents.
**The Warm Ground Rule.** Every neutral is warm. A cold grey, pure black, or blue-tinted neutral is a defect.
**The Decoupled Glow Rule.** A complaint card's glow color is its own token, separate from its background. The two are allowed to differ, and they do: the fill is dark, the glow is bright. The queue and the dashboard both follow it.

## Typography

**Display Font:** Plus Jakarta Sans (700 and 800 loaded; headings use 800), with Inter as fallback
**Body Font:** Inter
**Label/Mono Font:** JetBrains Mono

**Character:** A heavy, friendly geometric display face over a neutral workhorse body, with a mono voice for anything that behaves like a record: amounts, references, dates, and action labels. The mono micro-labels are the system's signature.

### Hierarchy
- **Display** (800, 3rem / 48px, line-height 1): the single hero number per screen, such as the on-time collections percentage.
- **Headline** (800, 1.875rem / 30px on sm and up, 1.5rem / 24px on mobile, line-height 1.2): page titles and the greeting.
- **Title** (800, 1.0625rem / 17px, line-height 1.3): section headings such as "Recent complaints" and "Rent status".
- **Body** (400, 0.8125rem / 13px, line-height 1.5): list rows, descriptions, form text. Secondary text drops to 55% white.
- **Label** (JetBrains Mono, 400, 0.6875rem / 11px, letter-spacing 0.025em, uppercase): eyebrows ("ON-TIME COLLECTIONS THIS MONTH"), table headers, filter chips, action buttons, amounts, tier badges. A 10px variant is used for tab labels and stat captions.

### Named Rules
**The Mono Record Rule.** Anything that is a record (amount, reference, date, status caption, action verb) is set in JetBrains Mono. Prose is never mono.
**The One Hero Rule.** Only one Display-size number appears on a screen.

## Layout

A shell plus content model. From the `sm` breakpoint (640px) up, a fixed 240px sidebar sits left of a scrolling main area. Below `sm`, the sidebar is replaced by a fixed 56px top bar and a fixed 64px bottom tab bar; main content gets matching top and bottom padding. The landlord's six sections collapse to five tabs (Home, Units, Finances, Issues, More), with Tenants and Settings folded into More.

Page content sits in a centered container up to `max-w-6xl` (72rem) with 24px padding, 32px from `sm` up. Vertical rhythm is 16 to 24px between blocks and 32px between major sections. On the dashboard the hero stat and a 2 by 2 block of stat tiles sit side by side from `sm` up and stack on mobile; two-column sections (complaints beside rent status) stack below `lg`. Complaints uses a master-detail layout: a 360px list panel beside the thread on desktop, full-screen list then thread on mobile.

Density is higher on landlord screens (scanning many units) and looser on tenant screens. On mobile, long values switch to compact forms (for example `$8.4K`, "COMPLAINTS" instead of "OPEN COMPLAINTS").

## Elevation & Depth

Flat by default. Depth comes from tonal layering (Night Earth, then Hearth, then Ember Card) and a 1px Ember Line border, not from shadows. There are exactly two exceptions: the urgency glow on complaint cards, and the drop shadow on small floating popovers.

### Shadow Vocabulary
- **Urgency glow** (`box-shadow: 0 0 22px -8px <underglow>` in the list panel, `0 0 24px -8px <underglow>` on the dashboard): a soft underlight in the priority's own underglow color, never the card's fill. It signals urgency and nothing else, so resolved and closed cards have none.
- **Popover** (`shadow-lg`): floating panels such as the upgrade prompt, anchored under the control that triggered them.
- **Dialog scrim** (black at 10% with a slight backdrop blur): behind modal dialogs, which are bordered with a 1px ring rather than a shadow.

### Named Rules
**The Flat-By-Default Rule.** A surface has no shadow at rest. Shadow or glow appears only for urgency or for something floating above the page.

## Shapes

Soft and rounded. Cards, stat tiles, alert banners and complaint cards use the largest radius (`rounded-2xl`, 24px in this project's scale); controls and inputs use 16px; pills for badges, chips and avatars are fully round. The base radius token is 1rem and every other radius derives from it, so a radius change is made in one place. No sharp corners, no clipped or angled silhouettes. The logo's house shape (a pentagon with a teal roof facet) is the only recurring custom geometry.

## Components

### Buttons
- **Shape:** rounded (16px), content-sized, never full-width on desktop.
- **Primary:** Msasa Terracotta fill, white mono label (11px, uppercase), 6px by 12px padding.
- **Action:** Msasa Glow fill for time-sensitive row actions such as MARK PAID.
- **Secondary / ghost:** the shared shadcn `Button` offers outline, secondary (teal), ghost, destructive (red tint) and link variants, with a 1px press translate and a 3px focus ring.
- **Hover / Focus:** transitions are short (about 100 to 200ms). Focus must always be visible; custom buttons rely on the shared focus ring.

### Chips
- **Filter chips:** pill, mono 11px. Selected is a solid terracotta fill with white text; unselected is Ember Card with Ember Line border and 55% white text.
- **Currency switch:** the USD / ZiG / Both control is a small segmented group in an Ember Card tray, selected segment in terracotta.

### Status badges
Small pills (mono or Inter 11px, 2px by 8px) with hue-matched text on a 15 to 18% tint of that hue. Used for rent status (Paid, Partial, Pending, Overdue, Waived) and payment method. EcoCash is always listed first.

### Cards / Containers
- **Corner Style:** 24px.
- **Background:** Ember Card (landlord) or Forest Card (tenant).
- **Shadow Strategy:** none; see Elevation.
- **Border:** 1px Ember Line (or Forest Line).
- **Internal Padding:** 16px for stat tiles and list cards, 24px for the hero stat.

### Inputs / Fields
- **Style:** Ember Card fill, 1px Ember Line border, 16px radius, white text, 55% white placeholder. Search fields carry a 14px leading icon.
- **Focus:** a visible ring in terracotta. Never remove the outline without replacing it.
- **Error / Disabled:** red border with a soft red ring for invalid; 50% opacity for disabled.

### Navigation
- **Sidebar:** 240px, Hearth fill. Items are 16px-radius rows with an icon and label. Active is terracotta text on a 10% terracotta tint with a 1px terracotta border; inactive is 55% white. A red count pill marks open complaints. The footer holds the avatar, organisation name and a mono tier badge ("PRO · 40 UNITS").
- **Mobile:** a 56px top bar (logo, notifications) and a 64px bottom tab bar with 20px icons and 10px labels. Active is terracotta.

### Complaint card (signature)
A full-width card with a dark fill tinted toward its priority (critical red, high burnt orange, medium amber) carrying "Unit 4B · Tenant name", relative time, a one-line title and a text line such as "HIGH · OPEN", with a soft underglow in the brighter hue of the same family. Resolved and closed cards are flat. The active card in the master-detail list gets a 2px Msasa Glow outline. Text is white at 100% and 80%.

### Hero stat (signature)
The on-time collections card: a mono eyebrow, a 48px Display number, and a green or red trend line with an arrow icon. One per screen.

## Do's and Don'ts

### Do:
- **Do** show money in both currencies: "$1,200 USD" with the ZiG equivalent, and keep a visible exchange-rate pill near any total.
- **Do** put EcoCash first in every payment-method list, and show payment method and status as pills on every rent row.
- **Do** tint proof-pending ledger rows with terracotta at 8% so a landlord can find evidence to review.
- **Do** keep touch targets comfortable on mobile (aim for 44px) even where desktop rows are compact.
- **Do** use skeletons that match the final layout so nothing shifts on a slow connection.
- **Do** write dates as "Monday, 22 June 2026" and phones as +263 7X XXX XXXX.

### Don't:
- **Don't** introduce cold greys, pure black, or blue-tinted neutrals; every neutral is warm.
- **Don't** add textures, patterns, or new hairline dividers between sections.
- **Don't** use the urgency glow for anything except complaint priority.
- **Don't** mix the terracotta and teal voices on one screen.
- **Don't** hard-block or blank gated features; render them blurred with an upgrade prompt to billing.
- **Don't** show an in-app payment control, analytics, announcements or any other Phase 1 out-of-scope feature, even as a teaser.

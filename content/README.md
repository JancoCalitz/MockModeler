# Question bank format

Everything here is YAML, checked when the app builds. `npm run content:validate` runs the same
check on its own. A bad file stops the build.

| Folder               | Holds                                                        |
| -------------------- | ------------------------------------------------------------ |
| `tracks/`            | One file per certification: its format and blueprint domains |
| `questions/<track>/` | Lists of questions, in any number of files                   |
| `scenarios/`         | Case studies, which several questions can share              |
| `notes/`             | Study notes, one entry per blueprint domain                  |
| `exams/`             | Fixed mocks, one per file                                    |
| `bpmn/`              | BPMN diagrams, as Camunda Modeler saves them                 |

## Rules

- Write original questions only. Never use real exam questions, braindumps, or leaked material.
- Back every answer with a docs page for the track's Camunda version: `/docs/8.7/` for Associate,
  and `/docs/8.8/` for Developer. Set `reviewed: true` once a person has checked it against that
  page.
- Write four options, all of a similar length, with no option that gives the answer away. Avoid
  "both", "neither", "above", "below", and "none of" in options, as these keep the options in their
  written order, so the answer would always show first.
- Timed mocks use single-answer questions only, as the real exam does. Multi-select questions and
  questions with a `scenario` appear in drills. A track's `mock` settings change this.

## A question

```yaml
- id: a-comp-zeebe # lowercase words and hyphens, unique across the bank
  track: associate # associate or developer
  domain: camunda-components # a domain id from the track's file
  difficulty: easy # easy, medium, or hard
  stem: Which Camunda 8 component is the engine that executes BPMN processes?
  options: [Zeebe, Operate, Optimize, Console]
  correctIndexes: [0] # options are shuffled on screen, so writing the answer first is fine
  explanation: Zeebe is the process automation engine that powers Camunda 8.
  source:
    url: https://docs.camunda.io/docs/8.7/components/zeebe/zeebe-overview/
    version: '8.7'
```

Optional fields:

- `multiSelect: true`, with two or more `correctIndexes`. Practice only.
- `scenario: <id>` to show a case study from `scenarios/` beside the question. Practice only.
- `reviewed: true` once checked against the docs.
- One of `diagram`, `dmn`, or `feel`, below.

### A BPMN diagram

```yaml
diagram:
  file: order-routing # content/bpmn/order-routing.bpmn
  highlight: [Gateway_Amount] # element ids to colour, optional
  description: >- # read by screen readers, and shown under the diagram
    A process starts, runs the service task Check order, ...
```

The file needs its diagram layout, which Camunda Modeler always saves. Every diagram must be used
by a question, and every highlighted id must exist in it.

### A DMN decision table

```yaml
dmn:
  name: Shipping fee
  hitPolicy: UNIQUE # UNIQUE, FIRST, ANY, COLLECT, or RULE ORDER
  inputs:
    - { label: Customer type, expression: customerType }
  output: { label: Fee, name: fee }
  rules: # `when` cells are FEEL unary tests, and `-` matches anything
    - { when: ['"Gold"'], then: '0' }
    - { when: ['"Standard"'], then: '5' }
  given: { customerType: Standard }
```

The build evaluates the table, and the correct option must match the result exactly: `5`, `"Gold"`,
or `["a", "b"]` for a list. Set `ask: rules` to ask which rules match, written `Rule 2` or
`Rules 1, 3`. If the correct option is in words, set `expectedResult` to what the build should
compute instead: `hit policy violation` or `no rule matches`.

### A FEEL expression

```yaml
feel:
  expression: 'items[1]'
  context: { items: [10, 20, 30] }
options: ['10', '20', '30', 'null']
```

The build evaluates the expression, and the correct option must match it, written the same way as
for DMN. No other option may give the same result. The build uses
[feelin](https://github.com/nikku/feelin), not Camunda's own engine, so stick to behaviour the docs
describe.

## Balance

For each track, the build counts the questions a mock can use in each domain, and compares them with
the blueprint weighting. A domain may differ from its expected count by 2 questions, or 25%,
whichever is more. Fixed mocks are checked the same way. Add questions across domains together,
roughly in proportion to the weightings.

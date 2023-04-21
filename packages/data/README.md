# Block Qualified Data Package

### Install 
Install the @bq-core/data package with npm:

```npm i @bq-core/data```

or yarn:

```yarn add @bq-core/data```

### Usage 

```js
import { BlockQualifiedSubgraph } from "@bq-core/data"

const blockQualifiedSubgraph = new BlockQualifiedSubgraph("maticmum")

// Get all members from the grade group
const gradeGroupMembers = await this.#subgraph.getGroupMembers(this.#credentialId, "grade")

// Get all members from the credentials group
const gradeGroupMembers = await this.#subgraph.getGroupMembers(this.#credentialId, "grade")

// Get all members from the no-credentials group
const gradeGroupMembers = await this.#subgraph.getGroupMembers(this.#credentialId, "grade")
```
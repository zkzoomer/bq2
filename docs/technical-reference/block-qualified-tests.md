## Block Qualified Tests

The `Test` object is at the core of the protocol: it defines the credential and what is needed to obtain it.

Each test contains two distinct components:

- A **multiple choice** component, where the answer to each question is part of a given finite set. The grade for this component is only awarded if the user gets all the answers right.
- An **open answer** component, where the answer to each question can be any value. The grade for this component is awarded incrementally per answer that the user gets right.

Each of these components can have a maximum of 64 questions.

The final grade of a test is calculated with a weighted sum of these two components. This weighted sum is defined by the value `multipleChoiceWeight`, which is the percentage of the multiple choice part towards the final grade.
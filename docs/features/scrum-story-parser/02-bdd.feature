Feature: Faithful Scrum story document parsing
  @auto
  Scenario: CP-01 Exported criteria and scenarios
    Given a story with bold criterion labels, emphasized scenarios and nested context
    When its body is parsed
    Then each criterion and scenario retains its content and order
    And context is separate from description

  @auto
  Scenario: CP-02 Alternative document formatting
    Given a story with bold section titles and numbered criteria
    When its body is parsed
    Then nested lists remain inside their criterion
    And comments are not scenarios

  @auto
  Scenario: CP-03 Missing structured requirements
    Given an exported story with only an unstructured description
    When its body is parsed
    Then metadata and comments are excluded from the description
    And no criteria or scenarios are invented

@one @two
Feature: Feature

  Background:
    When I do test

  Scenario: verify config
    When I verify that config loaded

  Scenario: verify memory
    When I verify that memory loaded

  Scenario: verify process env
    When I verify that process env loaded

  Scenario: verify overrides
    Given I do test

  Scenario: import cjs
    Given I import cjs

  Scenario: import esm
    Given I import esm

  Scenario: execute composite step
    Given I execute composite step

  Scenario: custom memory value type read
    When Read memory "$customValue" from cucumber type
    When Read memory '$customValue' from cucumber type

  Scenario: custom memory value type write
    When write '42' to 'memory' value
    When write "43" to 'memory' value

  Scenario Outline: validation type (<validation>)
    When I expect '<argument1>' <validation> '<argument2>'

    Examples:
      | argument1      | argument2                                                      | validation                 |
      | 1              | 1                                                              | to equal                   |
      | 1              | 2                                                              | to not equal               |
      | test           | tes                                                            | to contain                 |
      | 1              | 1                                                              | to strictly equal          |
      | $js({ a: 1 })  | $js({ a: 1 })                                                  | to deeply equal            |
      | Test           | test                                                           | to case insensitive equal  |
      | $js([1, 2, 3]) | $js([3])                                                       | to include members         |
      | $js([3, 2, 1]) | $js([1, 2, 3])                                                 | to have members            |
      | $js({ a: 1 })  | a                                                              | to have property           |
      | $js(2)         | $js(1)                                                         | to be greater than         |
      | $js(1)         | $js(2)                                                         | to be less than            |
      | test           | tes.                                                           | to match                   |
      | $js("Test")    | string                                                         | to have type               |
      | $js({ a: 1 })  | $js({ type: "object", properties: { a: { type: "number" } } }) | to match schema            |
      | 1              | $js(arg => ["1","2"].includes(arg))                            | to satisfy                 |

  @testFixture
  Scenario: fixture
    When I expect '$valueFromFixture' to equal 'qavajsFixture'

  Scenario: Template
    When I click 'a' and verify '42'
    When I expect '1' to equal '1'

  Scenario: called test
    When I expect '1' to equal '1'
    And data table step:
      | x |
      | 1 |
    When multiline step:
      """
      multiline text
      """

  Scenario: execute test
    Given dependency 'test-e2e/features/Feature.feature' 'called test'
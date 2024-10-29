@one @two
Feature: Feature

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

  Scenario: validation type
    When I expect '1' to equal '1'
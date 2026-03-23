Feature: Execute nested test

  Scenario: Login
    Given first step
    And second step

  Scenario: With table and doc string
    Given table step
      | key | value |
      | a   | 1     |
    And doc step
      """
      payload
      """

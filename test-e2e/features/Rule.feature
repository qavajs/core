@one @two
Feature: rule feature

  Background:
    Given log 'global background'

  Scenario: scenario in feature
    Given log 'scenario in feature'

  Rule: first rule
    Background:
      Given log 'background first rule'

    Scenario: scenario in first rule
      Given log 'scenario in first rule'

  Rule: second rule
    Background:
      Given log 'background second rule'

    Scenario: scenario in second rule
      Given log 'scenario in second rule'
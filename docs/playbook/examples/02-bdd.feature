Feature: Supplier registration

  Scenario: Register a valid supplier
    Given I am a user with the "purchasing" permission
    When I save a supplier with name "Acme Ltd" and a valid tax id
    Then the supplier appears in the supplier list

  Scenario: Duplicate tax id
    Given a supplier with tax id "12.345.678/0001-90" exists
    When I try to register another supplier with the same tax id
    Then I see the existing supplier and no duplicate is created

  Scenario: Missing permission
    Given I am a user without the "purchasing" permission
    When I open the supplier form
    Then the save action is not available and the API answers 403

# Product Requirements Document (PRD) - YogaFlow Lite

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [User Problem](#2-user-problem)
3. [Functional Requirements](#3-functional-requirements)
4. [Project Scope](#4-project-scope)
5. [User Stories](#5-user-stories)
6. [Success Metrics](#6-success-metrics)

## 1. Product Overview

YogaFlow Lite is a minimalist and aesthetic web application designed for browsing yoga poses (asanas) and creating personal, reusable practice sequences. The project focuses on simplicity, a calming user experience, and providing a tool that allows users to build their own personalized flows.

### Target Audience

The target audience for the MVP is individuals who practice yoga independently (already possessing basic knowledge) and yoga instructors who can use the application to plan their classes.

### Key Risks

The most significant identified risk is the timely delivery of editorially and legally verified (regarding licenses) photos and descriptions of all yoga poses to be included in the MVP. A final, non-negotiable deadline for delivering these materials must be established to avoid delays in product development.

## 2. User Problem

Currently, there is a lack of an easily accessible, simple digital tool that allows for the flexible creation, saving, and use of one's own personalized yoga sequences. Practitioners and instructors are often forced to use pre-made, imposed plans in existing applications that do not meet their individual needs, or to write down sequences in notebooks, which is impractical. YogaFlow Lite aims to solve this problem by offering a flexible and intuitive tool for building one's own practices.

## 3. Functional Requirements

### FR-1: User Authentication

- Registration of a new account using an email address and password
- Logging into an existing account using an email address and password
- Authentication is required to create, save, and manage personal sequences

### FR-2: Pose Library

- A clear gallery of yoga poses accessible to all users
- Each pose includes an illustration/photo, English name, Sanskrit name, and a brief description of how to perform it
- Functionality to filter poses by difficulty level (e.g., beginner, intermediate) and type (e.g., standing, seated)
- Functionality to search for poses by name (English or Sanskrit)

### FR-3: Sequence Builder

- Logged-in users can create new, named sequences
- Ability to add poses from the library to a created or edited sequence with a single click
- User dashboard for browsing, managing, and deleting saved sequences
- Ability to change the order of poses within a sequence using "up/down" buttons
- Ability to remove individual poses from a sequence

### FR-4: Practice Mode

- A minimalist, distraction-free interface for practicing based on a saved sequence
- Displays one pose at a time, including the image, names, and description
- Manual "Next" and "Back" navigation allowing for practice at one's own pace
- A button to end the practice and return to the user dashboard

### FR-5: Accessibility

- The application must meet basic accessibility standards (WCAG)
- All images in the application must have alternative text (alt attribute)
- The interface must maintain high color contrast to ensure readability

## 4. Project Scope

### Features Included in MVP

- Registration and login exclusively via email/password
- Pose library with predefined, permanently loaded content
- Filtering by difficulty level and pose type
- Creating, naming, saving, deleting, and reordering poses in sequences
- Manually controlled practice mode

### Features Excluded from MVP

- Social media login (Google, Facebook, etc.)
- Admin panel for adding and editing poses from the interface level
- Advanced filters (e.g., by body part, health benefits)
- Automatic timers or audio cues in practice mode
- Social features, such as sharing sequences with other users
- Expanded user profiles

## 5. User Stories

### US-001: New User Registration

**Description:** As a new user, I want to be able to create an account using my email address and password, so I can access the feature of saving sequences.

**Acceptance Criteria:**

- The registration form includes fields for email address, password, and password confirmation
- Client-side validation checks if the email has a correct format and if the passwords match
- After successful registration, the user is automatically logged in and redirected to their dashboard
- If the email is already taken, the user receives a clear error message

### US-002: User Login

**Description:** As a registered user, I want to be able to log into my account using my email address and password.

**Acceptance Criteria:**

- The login form includes fields for email address and password
- After successful login, the user is redirected to their dashboard
- If incorrect login credentials are provided, the user receives a clear error message

### US-003: User Logout

**Description:** As a logged-in user, I want to be able to log out of the application.

**Acceptance Criteria:**

- There is a clearly marked "Logout" button in the interface
- After clicking the button, the user's session is terminated, and they are redirected to the homepage

### US-004: Guest Access to Pose Library

**Description:** As an unauthenticated user (guest), I want to be able to browse, search, and filter poses in the pose library.

**Acceptance Criteria:**

- A guest has full access to the pose library view
- A guest can use the search and filter functionalities
- When attempting to add a pose to a sequence (or any other action requiring login), the guest is prompted to log in or register

### US-005: Viewing Pose Details

**Description:** As a user, I want to be able to see detailed information about a selected pose.

**Acceptance Criteria:**

- Clicking on a pose in the library opens a detailed view
- The detailed view includes a large image, English name, Sanskrit name, and a description of how to perform it

### US-006: Creating a New Sequence

**Description:** As a logged-in user, I want to be able to create a new, empty sequence and give it a unique name.

**Acceptance Criteria:**

- There is a "Create new sequence" button in the user dashboard
- After clicking, a field appears to enter the sequence name (e.g., "Morning Energy")
- After confirming the name, the new, empty sequence appears on my list of sequences

### US-007: Adding a Pose to a Sequence

**Description:** As a logged-in user browsing the pose library, I want to be able to add a selected pose to one of my sequences with a single click.

**Acceptance Criteria:**

- There is an "Add to sequence" button on each pose card in the library
- After clicking the button, the user can choose which of their saved sequences to add the pose to
- After adding the pose, the user receives visual confirmation (e.g., a short "Added" message)

### US-008: Managing Poses within a Sequence

**Description:** As a logged-in user, I want to be able to reorder and remove poses within my saved sequence.

**Acceptance Criteria:**

- In the sequence edit view, each pose on the list has "up" and "down" arrow buttons
- Clicking an arrow moves the pose one position in that direction
- Each pose on the list has a "Remove" button, which deletes it from the sequence

### US-009: Starting Practice Mode

**Description:** As a logged-in user, I want to be able to start a saved sequence in practice mode.

**Acceptance Criteria:**

- On my list of sequences, each one has a "Start Practice" button
- Clicking the button takes me to the practice mode interface, displaying the first pose from the sequence

### US-010: Navigation in Practice Mode

**Description:** As a user in practice mode, I want to be able to manually move to the next and previous pose.

**Acceptance Criteria:**

- The practice mode interface includes visible "Next" and "Back" buttons
- The "Next" button is disabled on the last pose, and the "Back" button is disabled on the first
- The user can freely move through the sequence in both directions

### US-011: Ending Practice Mode

**Description:** As a user in practice mode, I want to be able to end the session at any time.

**Acceptance Criteria:**

- There is an "End" button or an "X" icon on the practice screen
- After clicking it, I am taken back to my user dashboard

### US-012: Deleting an Entire Sequence

**Description:** As a logged-in user, I want to be able to delete an entire saved sequence.

**Acceptance Criteria:**

- On my list of sequences, each one has a "Delete" button
- After clicking the button, a confirmation prompt appears to prevent accidental deletion
- After confirmation, the sequence is permanently deleted from my account

### US-013: Image Accessibility

**Description:** As a user relying on a screen reader, I want all pose images to have alternative text that describes what they depict.

**Acceptance Criteria:**

- Every `<img>` element in the application has an alt attribute
- The value of the alt attribute includes the name of the pose (e.g., "Downward-Facing Dog Pose")

## 6. Success Metrics

The main goal of the MVP is to validate the hypothesis that users need and will regularly use a simple tool for creating their own yoga sequences.

### Key Performance Indicator (KPI)

**7-day User Retention Rate:** Measures the percentage of users who return to the application within 7 days of their first visit. A high rate will indicate that the application is useful and solves a real problem.

### Additional Metrics

- **Average number of sequences created and saved per active user:** This will show how intensively users are engaging with the core feature of the product
- **Number of completed sessions in Practice Mode:** This will indicate whether users are not only creating sequences but also actually using them for practice
- **Guest-to-Registered-User Conversion Rate:** This will measure how effectively we encourage unauthenticated users to create an account

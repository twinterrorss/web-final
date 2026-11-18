# Cyber Win — Final Web Project

## About the Project

Cyber Win is a sports and gaming website that we made for our Web Development course.

This project is a continuation of our midterm and endterm projects. For the final project, we added new features using JavaScript, APIs, OOP and localStorage.

The website has several pages: Sports, Casino, Live Casino, Esports and Profile.

Our main goal was to make the website more interactive and allow users to work with real match data.

## Group Members

- **Member 1:** Maxim Tselichshev — API Integration and OOP
- **Member 2:** Mubarak Bolat — LocalStorage and CRUD
- **Member 3:** Alikhan Seitmukhambetov — Advanced Match Filtering, testing and README

## Technologies Used

- HTML
- CSS
- Bootstrap
- JavaScript
- jQuery
- REST APIs
- JSON
- localStorage
- Git and GitHub

## New Features

### 1. API Integration

We connected our website to sports APIs to get match information.

We used `fetch()` and `async/await` to request data. The API returns JSON, which we use to display match information on the website.

### 2. Object-Oriented Programming

We created a JavaScript class called `Match`.

The class has a constructor, properties and methods. It helps us organize match information and use it in different parts of the website.

### 3. LocalStorage

We use localStorage to save information in the browser.

For example, users can save their match schedule and notes. The data stays saved even after refreshing the page.

### 4. CRUD

We added a match schedule where users can:

- Add a match
- View saved matches
- Edit match information and notes
- Delete saved matches

### 5. Advanced Match Filtering

We added filters to make finding matches easier.

Users can:

- Search matches by team name
- Filter by match status
- Filter by date
- Sort matches by date
- Reset all filters

We used JavaScript methods like `filter()`, `includes()` and `sort()` for this feature.

## Other Features

We also kept the features from our previous projects, including:

- Different website pages
- Profile editing and form validation
- Light and dark mode
- Responsive design
- Interactive sports sections
- Casino and Esports pages
- Demo bet slip

## API Information

Our project uses MoviOdds for sports data and ESPN as a fallback source for supported sports.

The API requests are handled in `assets/js/match-api.js`.

We use JSON data to display team names, match dates, statuses, scores and available odds.

Some information may not be available if the API does not return it. An internet connection is needed to load remote match data.


## Notes

Cyber Win is a student project made for educational purposes.

The betting interface and balance are demonstrations. No real money is used.

We worked on different parts of the project, but every group member should understand how the whole website works.

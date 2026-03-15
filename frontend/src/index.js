import React from 'react';
import ReactDOM from 'react-dom/client';
import './Util/index.css';
import App from './Util/App';
import reportWebVitals from './Util/reportWebVitals';
import {createBrowserRouter, RouterProvider} from 'react-router-dom';

import Homepage from "./Pages/Homepage";
import NotFoundPage from "./Pages/NotFoundPage";

import InstructorHomepage from "./Pages/Instructor/InstructorHomepage";
import InstructorCourseView from "./Pages/Instructor/InstructorCourseView";
import InstructorAssignmentView from "./Pages/Instructor/InstructorAssignmentView";
import CreateAssignment from "./Pages/Instructor/CreateAssignment";

import StudentHomepage from "./Pages/Student/StudentHomepage";
import StudentCourseView from "./Pages/Student/StudentCourseView";
import StudentAssignmentView from "./Pages/Student/StudentAssignmentView";
import CompareSimilarity from "./Pages/Instructor/CompareSimilarity";


const router = createBrowserRouter([
    /*TODO: Add User verification so that individual users sign in to their own profiles
        using a user id of some sort
        this needs to be added after the user sign in where they will be
        brought to their own personal homepage
     */
    {
        path: '/',
        element: <Homepage/>,
        errorElement: <NotFoundPage/>
    },
    {
        path: '/instructorHomepage/:name',
        element: <InstructorHomepage/>,
    },
    {
        path: '/studentHomepage/:name',
        element: <StudentHomepage/>
    },
    {
        path: '/studentCourseView/:name/:classId',
        element: <StudentCourseView/>
    },
    {
        path: '/instructorCourseView/:name/:classId',
        element: <InstructorCourseView/>
    },
    {
        path: '/instructorAssignmentView/:name/:classId/:assignment',
        element: <InstructorAssignmentView/>
    },
    {
        path: '/studentAssignmentView/:name/:classId/:assignment',
        element: <StudentAssignmentView/>
    },
    {
        path: '/createAssignment/:name/:classId',
        element: <CreateAssignment/>
    },
    {
        path: '/compareSimilarity/:student1/:student2',
        element: <CompareSimilarity/>
    },
    ]);
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
      <RouterProvider router = {router}/>
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

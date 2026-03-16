import "../Styling.css"
import {Link, useNavigate} from "react-router-dom";
function StudentCourseView() {
    const nav = useNavigate()
    const returnHome = () => {
        nav('/');
    }
    /*
        TODO: add functionality to go to a selected assignment and homepage
        currently just default values for name, class, and assignment
     */
    const goToAssignment = () => {
        nav('/studentAssignmentView/name/class/assignment');
    }
    const toStudentHomepage = () => {
        nav('/studentHomepage/name');
    }

    const numberAssignments = 10;
    let assignmentID = 'a'

    /**
     * based on the number of submissions for an assignment a course has, return their assignments dynamically
     * TODO: get the user's information from the backend
     * @returns {JSX.Element}
     * html to be displayed to the user
     */
    function renderAssignments(position){
        //pass in a student's data to be displayed
        if (position === 'L') {
            return (
                <section className={'displStuLeft'}>
                    <h2>{assignmentID}</h2>
                    <button type={'button'} onClick={goToAssignment} className={'standardButton'}>Go To Assignment
                    </button>
                </section>
            );
        } else if (position === 'R') {
            return (
                <section className={'displStuRight'}>
                    <h2>{assignmentID}</h2>
                    <button type={'button'} onClick={goToAssignment} className={'standardButton'}>Go To Assignment
                    </button>
                </section>
            );
        }
    }

    /**
     * Loads the required number of assignments for a user
     * @returns {JSX.Element}
     */
    function render() {
        const stuList = [];

        for (let i = 0; i < numberAssignments; i++) {
            if (i % 2 === 0) {
                stuList.push(renderAssignments('R'));
            } else {
                stuList.push(renderAssignments('L'));
            }
        }

        return <>{stuList}</>;
    }

    return (
        <div>
            <h1 className="header">Student Course View</h1>
            <br/>
            <br/>
            <br/>
            <br/>
            <section className="sidebar">
                <p className={'sidebarTextbox'}>Menu</p>
                <button type={'button'} onClick={toStudentHomepage} className={'sidebarButton'}>Back To Homepage
                </button>
                <br/>
                <br/>
                <button type={'button'} onClick={returnHome} className={'sidebarButton'}>Sign Out</button>
                <br/>
            </section>
            <section className={'studentList'}>
                {render()}
            </section>
        </div>
    );
}

export default StudentCourseView
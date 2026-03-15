import "../Styling.css"
import {Link, useNavigate, useParams} from "react-router-dom";
function InstructorCourseView() {
    const nav = useNavigate()
    const {name} = useParams();
    const {classId} = useParams();


    //TODO: add ability to navigate to a selected assignment, rn it just goes to a default 'a'
    let assignmentID = 'a'
    const returnHome = () => {
        nav('/');
    }
    //TODO: Define assignmentID
    const goToAssignment = () => {
        nav('/instructorAssignmentView/' + name + '/' + classId + '/' +assignmentID);
    }
    const goToInstrHome = () => {
        nav('/instructorHomepage/' + name);
    }
    const ca = () => {
        nav('/createAssignment/' + name + '/' + classId);
    }

    const numberAssignments = 20;

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

    //TODO: load the correct number of assignments ---------------------------
    let stuList;

    function render() {
        for (let i = 0; i < numberAssignments; i++) {
            if (i % 2 === 0) {
                stuList += renderAssignments('R')
            } else {
                stuList += renderAssignments('L')
            }
        }
        return({stuList})
    }

    return(
        <div>
            <h1 className="header">Instructor Course View</h1>
            <div className="sidebar">
                <p className={'sidebarTextbox'}>Menu</p>
                <button type={'button'} onClick={goToInstrHome} className={'sidebarButton'}>Back To Homepage</button>
                <br/>
                <br/>
                <button type={'button'} onClick={returnHome} className={'sidebarButton'}>Sign Out</button>
                <br/>
                <br/>
                <button type={'button'} onClick={ca} className={'standardButton'}>Create New Assignment</button>
            </div>
            <section className={'studentList'}>
                {renderAssignments('L')}
                {renderAssignments('R')}
            </section>
        </div>
    );
}


export default InstructorCourseView
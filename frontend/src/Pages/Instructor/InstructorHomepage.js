import "../Styling.css"
import {useNavigate, useParams} from "react-router-dom";
function InstructorHomepage() {
    const nav = useNavigate()
    const {name} = useParams();
    const classId = 'c'
    const returnHome = () => {
        nav('/');
    }
    const goToClass = () => {
        nav('/instructorCourseView/' + name + '/' + classId);
    }

    /**
     * based on the number of courses a user has return their courses dynamically
     * TODO: get the user's information from the backend
     * @returns {JSX.Element}
     * html to be displayed to the user
     */
    function renderCourses(position){
        //pass in a student's data to be displayed
        if (position === 'L') {
            return (
                <section className={'displStuLeft'}>
                    <h2>{courseName}</h2>
                    <button type={'button'} onClick={goToClass} className={'standardButton'}>Go To Class</button>
                </section>
            );
        } else if (position === 'R') {
            return (
                <section className={'displStuRight'}>
                    <h2>{courseName}</h2>
                    <button type={'button'} onClick={goToClass} className={'standardButton'}>Go To Class</button>
                </section>
            );
        }
    }

    //TODO: load the correct number of courses ---------------------------
    let corList;
    //TODO: courses from backend -----------------------------------------
    let numberCourses = 4
    let courseName = 'Course'

    //not sure how to actually get this to display
    function render() {
        for (let i = 0; i < numberCourses; i++) {
            if (i%2 === 0) {
                corList += renderCourses('R')
            } else {
                corList += renderCourses('L')
            }
        }
        return({corList})
    }

    return(
        <div>
            <h1 className="header">Instructor Homepage for {name}</h1>
            <section className="sidebar">
                <p className={'sidebarTextbox'}>Menu</p>
                <button onClick={returnHome} type={'button'} className={'sidebarButton'}>Sign Out</button>
            </section>
            <section className={'studentList'}>
                {renderCourses('L')}
                {renderCourses('R')}
                {renderCourses('L')}
            </section>
        </div>
    );
}

export default InstructorHomepage
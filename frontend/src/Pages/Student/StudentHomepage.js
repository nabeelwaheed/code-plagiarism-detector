import "../Styling.css"
import {Link, useNavigate, useParams} from "react-router-dom";
function StudentHomepage() {
    const nav = useNavigate()
    const {name} = useParams();
    const returnHome = () => {
        nav('/');
    }
    //TODO: add functionality to go to a selected class
    //currently just default names for name and class
    const goToClass = () => {
        nav('/studentCourseView/name/class');
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
    //TODO: courses from backend -----------------------------------------
    let numberCourses = 4
    let courseName = 'Course'

    //TODO: load the correct number of assignments ---------------------------
    /**
     * Loads the required number of courses for a user
     * @returns {JSX.Element}
     */
    function render() {
        const stuList = [];

        for (let i = 0; i < numberCourses; i++) {
            if (i % 2 === 0) {
                stuList.push(renderCourses('R'));
            } else {
                stuList.push(renderCourses('L'));
            }
        }

        return <>{stuList}</>;
    }

    return(
        <div>
            <section className="header">Student Homepage for {name}</section>
            <br/>
            <br/>
            <br/>
            <br/>
            <section className="sidebar">
                <p className={'sidebarTextbox'}>Menu</p>
                <button type={'button'} onClick={returnHome} className={'sidebarButton'}>Sign Out</button>
            </section>
            <section className={'studentList'}>
                {render()}
            </section>
        </div>
    );
}

export default StudentHomepage
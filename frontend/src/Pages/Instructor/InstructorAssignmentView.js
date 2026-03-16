import "../Styling.css"
import {Link, useNavigate, useParams} from "react-router-dom";
function InstructorAssignmentView() {
    const nav = useNavigate()
    const {name} = useParams();
    const {classId} = useParams();

    let name1 = ''
    let name2 = ''

    const returnHome = () => {
        nav('/');
    }
    const goToInstrHome = () => {
        nav('/instructorHomepage/' + name);
    }
    const goToCourse = () => {
        nav('/instructorCourseView/' + name + '/' + classId);
    }
    //navigate to the check similarity page
    //TODO: get the student's information such as name to navigate to a new page------
    //TODO: change the values of name1 & name2 to the actual student's ids------------
    function checkSimilarity(){
        if (name1 !== '' && name2 !== '') {
            nav('/compareSimilarity/' + name1 + '/' + name2)
        }else if (name1 !== '' && name2 === ''){
            name2 = 'name2'
        } else if (name1 === '' && name2 === ''){
            name1 = 'name1'
        }
    }
    //TODO: get similarity score for each submission ----------------------
    const similarity = 23;
    //TODO: load student submissions---------------------------------------
    const numberStudents = 20;

    /**
     * based on the number of submissions for an assignment a course has, return their assignments dynamically
     * TODO: get the user's information from the backend
     * @returns {JSX.Element}
     * html to be displayed to the user
     */
    function renderAssignments(){
        //pass in a student's data to be displayed
        return (
            <section className={'studentListElement'}>
                <h2>This is the first student</h2>
                <h2>Similarity Score: {similarity}%</h2>
                <button type={'button'} onClick={checkSimilarity} className={'stuButton'} id={'joe'}>Compare</button>
                <br/>
                <br/>
            </section>
        );
    }

    /**
     *
     * @returns {JSX.Element}
     */
    function render() {
        const stuList = [];

        for (let i = 0; i < numberStudents; i++) {
            stuList.push(renderAssignments());
        }

        return <>{stuList}</>;
    }

    return(
        <div>
            <header className={'header'}>Instructor Assignment View</header>
            <br/>
            <br/>
            <br/>
            <br/>
            <section className={'sidebar'}>
                <p className={'sidebarTextbox'}>Menu</p>
                <button type={'button'} onClick={goToCourse} className={'sidebarButton'}>Go Back To Course</button>
                <br/>
                <br/>
                <button type={'button'} onClick={goToInstrHome} className={'sidebarButton'}>Go Back To Homepage</button>
                <br/>
                <br/>
                <button type={'button'} onClick={returnHome} className={'sidebarButton'}>Sign Out</button>
            </section>
            <h1 className={'testing'}>Student Submissions</h1>
            <section className={'studentList'}>
                {render()}
            </section>
        </div>
    );
}


/*
<h1 className="header">Instructor Assignment View</h1>
            <div className={'helper'}>
            <div className="sidebar">
                <p className={'sidebarTextbox'}>Menu</p>
                <button type={'button'} onClick={goToCourse} className={'sidebarButton'}>Go Back To Course</button>
                <br/>
                <br/>
                <button type={'button'} onClick={goToInstrHome} className={'sidebarButton'}>Go Back To Homepage</button>
                <br/>
                <br/>
                <button type={'button'} onClick={returnHome} className={'sidebarButton'}>Sign Out</button>
            </div>
            <div className={'studentList'}>
                <h1>Student Submissions</h1>
                <div className={'studentListElement'}>
                    <p>Hello</p>
                </div>
            </div>
            </div>
 */
export default InstructorAssignmentView
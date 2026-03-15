import "../Styling.css"
import {Link, useNavigate, useParams} from "react-router-dom";
import getStudentSimilarity from "../../Util/getSudentSimilarity";
function CompareSimilarity() {
    const nav = useNavigate()
    const {student1} = useParams()
    const {student2} = useParams()

    const returnHome = () => {
        nav('/');
    }
    const goToInstrHome = () => {
        nav('/instructorHomepage/name');
    }
    const goToCourse = () => {
        nav('/instructorCourseView/name/course');
    }
    const goToAssignment = () => {
        nav('/instructorAssignmentView/name/course/assignment');
    }
    /**
     * TODO:    get the compared files from the backend and display them in the two
     *          fields using getStudentSimilarity in util folder
     */

    return(
        <div className={'testing'}>
            <header className={'header'}>Compare Similarity</header>
            <section className={'sidebar'}>
                <p className={'sidebarTextbox'}>Menu</p>
                <button type={'button'} onClick={goToAssignment} className={'sidebarButton'}>Back To Assignment</button>
                <br/>
                <br/>
                <button type={'button'} onClick={goToCourse} className={'sidebarButton'}>Go Back To Course</button>
                <br/>
                <br/>
                <button type={'button'} onClick={goToInstrHome} className={'sidebarButton'}>Go Back To Homepage</button>
                <br/>
                <br/>
                <button type={'button'} onClick={returnHome} className={'sidebarButton'}>Sign Out</button>
            </section>
            <section className={'studentList'}>
                <h1>Student Files Comparison</h1>
                <section className={'studentListElement'}>

                    <section className={'displStuLeft'}>
                        <h2>First Student: {student1}</h2>
                        <p className={'displayBox'}>
                            {getStudentSimilarity(student1)}
                        </p>
                    </section>

                    <section className={'displStuRight'}>
                        <h2>Second Student: {student2}</h2>
                        <p className={'displayBox'}>
                            {getStudentSimilarity(student2)}
                            this is normal text
                            <p className={'highlight'}>this is highlighted</p>
                        </p>
                    </section>

                </section>
            </section>
        </div>
    );
}
export default CompareSimilarity
import "../Styling.css"
import {Link, useNavigate} from "react-router-dom";
import {checkForm} from "../../Util/checkForm";
function StudentAssignmentView() {
    const nav = useNavigate()
    const maxDescLength = 200
    const returnHome = () => {
        nav('/');
    }
    /*
        TODO: Add individual functionality to the next two
        currently using default values: name, class
     */
    const toStudentHomepage = () => {
        nav('/studentHomepage/name');
    }
    const toClass = () => {
        nav('/studentCourseView/name/class');
    }
    //TODO: add functionality for submitting to the backend--------------------------------
    const submitAssignment = () => {
        alert('Assignment Submitted!')
    }
    const trySubmit = () => {
        const btn = document.getElementsByName("btn")
        btn.disabled =  false;
    }

    return(
        <div>
            <h1 className="header">Student Assignment View</h1>
            <br/>
            <br/>
            <br/>
            <br/>
            <div className="sidebar">
                <p className={'sidebarTextbox'}>Menu</p>
                <button type={'button'} onClick={toClass} className={'sidebarButton'}>Back To Course</button>
                <br/>
                <br/>
                <button type={'button'} onClick={toStudentHomepage} className={'sidebarButton'}>Back To Student
                    Homepage
                </button>
                <br/>
                <br/>
                <button type={'button'} onClick={returnHome} className={'sidebarButton'}>Sign Out</button>
                <br/>
            </div>
            <div className={'testing'}>
                <h1>Assignment: /assignment name/</h1>
                <form className={'smallContainer'} onSubmit={submitAssignment} onKeyUp={checkForm} autoComplete="off"
                      noValidate>
                    <input
                        type="file"
                        accept={'.zip'}
                        name="aName"
                        placeholder="Assignment Title"
                        onChange={trySubmit}
                        required/>
                    <br/>
                    <br/>
                    <button
                        className={'standardButton'}
                        type="submit"
                        id="btn"
                    >Submit
                    </button>
                </form>
            </div>
        </div>
    );
}

export default StudentAssignmentView
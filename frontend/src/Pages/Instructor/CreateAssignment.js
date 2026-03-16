import "../Styling.css"
import {Link, useNavigate, useParams} from "react-router-dom";
import {useState} from "react";
import {checkForm} from "../../Util/checkForm";
function CreateAssignment() {
    const nav = useNavigate()

    const {name} = useParams();
    const {classId} = useParams();
    const {assignmentID} = useParams();

    const maxTextLength = 15;
    const maxDescLength = 200;
    const returnHome = () => {
        nav('/');
    }
    const goToInstrHome = () => {
        nav('/instructorHomepage/' + name);
    }
    const goToCourse = () => {
        nav('/instructorCourseView/' + name + '/' + classId);
    }
    let assignment = document.getElementsByName("aName")
    const goToAssignment = () => {
        let a = ''
        for (let i = 0; i < assignment.length; i++) {
            a += assignment[i];
        }
        //TODO:change this value to a newly generated assignment in the backend-------------------------------
        nav('/instructorCourseView/' + name + '/' + classId + '/' + assignmentID);
    }
    //TODO: Add functionality to create a new assignment and add it to the course
    const create = () => {
        alert('Assignment Created!')
    }

    return(
        <div>
            <h1 className="header">Create Assignment</h1>
            <br/>
            <br/>
            <br/>
            <br/>
            <section className="sidebar">
                <p className={'sidebarTextbox'}>Menu</p>
                <button type={'button'} onClick={goToCourse} className={'sidebarButton'}>Go Back To Course</button>
                <br/>
                <br/>
                <button type={'button'} onClick={goToInstrHome} className={'sidebarButton'}>Go Back To Homepage</button>
                <br/>
                <br/>
                <button type={'button'} onClick={returnHome} className={'sidebarButton'}>Sign Out</button>
            </section>
            <section className={'testing'}>
                <h1>Create Assignment</h1>
                <section className={'testing'}>
                    <form onSubmit={goToAssignment} onKeyUp={checkForm} autoComplete="off" noValidate>
                        <input
                            type="text"
                            name="aName"
                            placeholder="Assignment Title"
                            maxLength={maxTextLength}
                            required/>
                        <br/>
                        <input
                            className={'bigBox'}
                            type="text"
                            name="aDescription"
                            placeholder="Description"
                            maxLength={maxDescLength}
                        />
                        <br/>
                        <button
                            className={'standardButton'}
                            type="submit"
                            id="btn"
                            disabled>Create
                        </button>
                    </form>
                </section>
            </section>
        </div>
    );
}

/*
<form onSubmit={handleSubmit}>
                        <label htmlFor="nameInput">Assignment Name: </label>
                        <br/>
                        <input
                            id="nameInput"
                            type="text"
                            maxLength={maxTextLength}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                        />
                        <br/>
                        <br/>
                        <label htmlFor="description">Description: </label>
                        <br/>
                        <input
                            id="description"
                            className={'bigBox'}
                            type="text"
                            maxLength={maxDescLength}
                            value={desc}
                            onChange={(e) => setDesc(e.target.value)}
                        />
                        <br/>
                        <br/>
                        <button type="submit" className={'standardButton'}>Submit</button>
                    </form>
 */
export default CreateAssignment
function showLoader() {
    $('#loader').show();
}

function hideLoader() {
    $('#loader').hide();
}


function showSwal(message, status) {
    if (status) {
        Swal.fire({
            icon: 'success',
            title: 'Message',
            text: message,
        });
    } else {
        Swal.fire({
            icon: 'error',
            title: 'Message',
            text: message,
        });
    }
}

function showConfirmSwal(message, confirmButtonText, denyButtonText) {
    return Promise.resolve(Swal.fire({
        title: 'Warning',
        icon: 'warning',
        text: message,
        showDenyButton: true,
        showCancelButton: true,
        confirmButtonText: confirmButtonText,
        denyButtonText: denyButtonText
    }).then((result) => {
        if (result.isConfirmed) {
            return true;
        }
        else {
            return false;
        }
    }));
}
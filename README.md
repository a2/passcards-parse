**Deprecated** in favor of [passcards-swift](https://github.com/a2/passcards-swift).

---

# PassCards

## Schema Configuration

### User

*No added columns.*

### Installation

|           Name          |       Type      |
| ----------------------- | --------------- |
| deviceLibraryIdentifier | String          |
| pass                    | Pointer\<Pass\> |


### Pass

|           Name          |       Type      |
| ----------------------- | --------------- |
| authenticationToken     | String          |
| creator                 | Pointer\<User\> |
| file                    | File            |
| passTypeIdentifier      | String          |
| serialNumber            | String          |

## Permissions

For User and Installation, set every permission to *Disabled*.

For the *Pass* class, set the "Add fields" permission to *Disabled* and manually add your User object ID to each other permission.
